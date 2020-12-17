/*
 * Created by Jim McAndrew on 11/6/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import * as Dronelink from "dronelink-kernel"
import Moment from "react-moment"
import { compose } from "recompose"
import { withTheme, withStyles } from "@material-ui/core/styles"
import { withFirebase } from "../../components/firebase"
import { Menu, MenuItem, ListItemIcon, ListItemSecondaryAction, IconButton, Button, List, ListItemText, LinearProgress, ListItem, ListItemAvatar, Avatar, Typography } from "@material-ui/core"
import { MoreVert as MoreIcon, DeleteForeverOutlined as DeleteIcon } from "@material-ui/icons"
import { History as VersionsIcon, DeleteSweepOutline as RevertIcon } from "mdi-material-ui"

const styles = (theme) => ({
    header: {
        display: "flex",
        alignItems: "center",
        padding: `${theme.spacing(1)}px ${theme.spacing(1)}px ${theme.spacing(1)}px ${theme.spacing(2)}px`,
        backgroundColor: theme.palette.background.default
    },
    loadingContainer: {
        minHeight: 50
    },
    loadingProgress: {
        margin: theme.spacing(2)
    },
    icon: {
        marginRight: theme.spacing(1)
    },
    grow: {
        flexGrow: 1
    },
    create: {
        margin: `${theme.spacing(2)}px ${theme.spacing(2)}px ${theme.spacing(1)}px ${theme.spacing(2)}px`
    }
})

class ModeVersions extends Component {
    state = {
        versions: null,
        more: null
    }

    componentDidMount() {
        this.unsubscribeModeVersions = this.props.modeVersionsRef.orderBy("created", "desc").onSnapshot((snapshot) => {
            if (snapshot.metadata.hasPendingWrites) {
                return
            }

            this.setState({
                versions: snapshot.docs
                    .map((doc, index) => {
                        const version = { ...{ id: doc.id }, ...doc.data() }
                        version.ref = doc.ref
                        version.mode = Dronelink.Serialization.read(version.content)
                        version.index = index
                        version.ordinal = Dronelink.Format.integer(snapshot.docs.length - index)
                        return version
                    })
                    .filter((version) => {
                        return version.mode
                    })
            })
        })
    }

    componentWillUnmount() {
        if (this.unsubscribeModeVersions) {
            this.unsubscribeModeVersions()
        }
    }

    onMoreToggle = (e, version) => {
        this.setState({ more: e ? { anchorEl: e.currentTarget, version: version } : null })
    }

    onOpen = (version) => {
        this.props.onOpen(Dronelink.Serialization.read(version.content))
    }

    onRevert = (version) => {
        this.setState({ more: null })
        window.notificationWidget.showAlertDialog({
            title: `Revert Version ${version.ordinal}`,
            content: "Reverting to this version will permanently delete all later versions. Are you sure you want to revert to this version?",
            actions: [
                {
                    title: "Revert",
                    color: "secondary",
                    onClick: () => {
                        this.props.firebase
                            .deleteModeVersions(
                                this.state.versions
                                    .filter((versionToDelete) => {
                                        return versionToDelete.created.toDate().getTime() > version.created.toDate().getTime()
                                    })
                                    .map((version) => {
                                        return version.ref
                                    })
                            )
                            .catch((e) => {
                                window.notificationWidget.showSnackbar(`Unable to revert: ${e.message}`)
                            })
                    }
                }
            ]
        })
    }

    onDelete = (version) => {
        this.setState({ more: null })
        window.notificationWidget.showAlertDialog({
            title: `Delete Version ${version.ordinal}`,
            content: "Are you sure you want to permanently delete this version?",
            actions: [
                {
                    title: "Delete",
                    color: "secondary",
                    onClick: () => {
                        this.props.firebase.deleteModeVersion(version.ref).catch((e) => {
                            window.notificationWidget.showSnackbar(`Unable to delete: ${e.message}`)
                        })
                    }
                }
            ]
        })
    }

    render() {
        const { versions, more } = this.state
        const { classes, readonly, onCreate, onClose } = this.props

        return (
            <Fragment>
                <div className={classes.header}>
                    <VersionsIcon color="action" className={classes.icon} />
                    <Typography variant="body2">Versions</Typography>
                    <div className={classes.grow} />
                    <Button size="small" color="primary" onClick={onClose}>
                        Done
                    </Button>
                </div>
                {!versions && (
                    <div className={classes.loadingContainer}>
                        <LinearProgress className={classes.loadingProgress} />
                    </div>
                )}
                {versions && (
                    <Fragment>
                        {onCreate && (
                            <div className={classes.create}>
                                <Button fullWidth size="small" variant="outlined" color="primary" onClick={onCreate}>
                                    New Version
                                </Button>
                            </div>
                        )}
                        <List dense>
                            {versions.map((version) => {
                                return (
                                    <ListItem
                                        key={version.id}
                                        alignItems="flex-start"
                                        button={versions.length > 1}
                                        onClick={
                                            versions.length > 1
                                                ? () => {
                                                      this.onOpen(version)
                                                  }
                                                : null
                                        }
                                    >
                                        <ListItemAvatar>
                                            <Avatar>{version.ordinal}</Avatar>
                                        </ListItemAvatar>
                                        <ListItemText secondary={version.mode.descriptors.toString()} primary={<Moment format="MMM D, YYYY [at] h:mm:ss a" date={version.created.toDate()} />} />
                                        {!readonly && versions.length > 1 && (
                                            <ListItemSecondaryAction>
                                                <IconButton
                                                    edge="end"
                                                    onClick={(e) => {
                                                        this.onMoreToggle(e, version)
                                                    }}
                                                >
                                                    <MoreIcon />
                                                </IconButton>
                                            </ListItemSecondaryAction>
                                        )}
                                    </ListItem>
                                )
                            })}
                        </List>
                    </Fragment>
                )}
                {more && (
                    <Menu
                        open
                        anchorEl={more.anchorEl}
                        onClose={() => {
                            this.onMoreToggle()
                        }}
                    >
                        {more.version.index > 0 && (
                            <MenuItem
                                onClick={() => {
                                    this.onRevert(more.version)
                                }}
                            >
                                <ListItemIcon>
                                    <RevertIcon />
                                </ListItemIcon>
                                <Typography variant="inherit">Revert</Typography>
                            </MenuItem>
                        )}
                        <MenuItem
                            onClick={() => {
                                this.onDelete(more.version)
                            }}
                        >
                            <ListItemIcon>
                                <DeleteIcon />
                            </ListItemIcon>
                            <Typography variant="inherit">Delete</Typography>
                        </MenuItem>
                    </Menu>
                )}
            </Fragment>
        )
    }
}

export default compose(withTheme, withStyles(styles), withFirebase)(ModeVersions)
