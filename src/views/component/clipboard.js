/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import Moment from "react-moment"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import { FileCopy as ClipboardIcon, DeleteOutline as DeleteIcon } from "@material-ui/icons"
import {
    Popover,
    Card,
    CardActions,
    IconButton,
    Button,
    Divider,
    CardContent,
    Badge,
    List,
    ListItem,
    Avatar,
    ListItemText,
    ListItemAvatar,
    ListItemSecondaryAction,
    Typography,
    CardHeader
} from "@material-ui/core"
import * as Dronelink from "dronelink-kernel"
import { ComponentUtils, Utils } from "react-dronelink"

const styles = theme => ({
    button: {
        position: "fixed",
        top: Utils.UI.headerHeight + theme.spacing(2),
        right: theme.spacing(1)
    },
    menu: {
        maxWidth: 400,
        minWidth: 300,
        padding: 0
    },
    icon: {
        color: "#fff"
    }
})

class ComponentClipboard extends Component {
    state = {
        anchorEl: null
    }

    onOpen = event => {
        this.setState({ anchorEl: event.currentTarget })
    }

    onClose = () => {
        this.setState({ anchorEl: null })
    }

    onDelete = index => {
        Utils.clipboard.splice(index, 1)
        this.setState({ anchorEl: null })
    }

    onDeleteAll = () => {
        Utils.clipboard = []
        this.setState({ anchorEl: null })
    }

    render() {
        const { classes } = this.props
        const { anchorEl } = this.state
        const open = Boolean(anchorEl)

        if (Utils.clipboard.length === 0) {
            return null
        }

        return (
            <Fragment>
                <IconButton className={classes.button} aria-owns={open ? "clipboard-menu" : undefined} aria-haspopup="true" aria-label="Clipboard" onClick={this.onOpen}>
                    <Badge badgeContent={Utils.clipboard.length} color="secondary">
                        <ClipboardIcon className={classes.icon} />
                    </Badge>
                </IconButton>
                {anchorEl && (
                    <Popover id="clipboard-menu" open={open} anchorEl={anchorEl} onClose={this.onClose}>
                        <Card>
                            <CardHeader
                                title={
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Clipboard
                                    </Typography>
                                }
                                action={
                                    <Button size="small" color="primary" onClick={this.onClose}>
                                        Done
                                    </Button>
                                }
                            />
                            <CardContent className={classes.menu}>
                                <List dense>
                                    {Utils.clipboard.map((element, index) => {
                                        if (element.component instanceof Dronelink.Component) {
                                            return (
                                                <ListItem key={index} dense alignItems="flex-start">
                                                    <ListItemAvatar>
                                                        <Avatar>{ComponentUtils.getIcon(element.component)}</Avatar>
                                                    </ListItemAvatar>
                                                    <ListItemText
                                                        primary={element.component.title}
                                                        secondary={
                                                            <Fragment>
                                                                {element.component.subtitle && (
                                                                    <Typography component="span" variant="body2" color="textSecondary" noWrap>
                                                                        {element.component.subtitle}
                                                                    </Typography>
                                                                )}
                                                                <br />
                                                                <Typography variant="caption" color="textSecondary">
                                                                    <Moment fromNow date={new Date(element.created)} />
                                                                </Typography>
                                                            </Fragment>
                                                        }
                                                        primaryTypographyProps={{ noWrap: false }}
                                                        secondaryTypographyProps={{ noWrap: true }}
                                                    />
                                                    <ListItemSecondaryAction>
                                                        <IconButton
                                                            edge="end"
                                                            onClick={() => {
                                                                this.onDelete(index)
                                                            }}
                                                        >
                                                            <DeleteIcon />
                                                        </IconButton>
                                                    </ListItemSecondaryAction>
                                                </ListItem>
                                            )
                                        }

                                        return null
                                    })}
                                </List>
                            </CardContent>
                            {Utils.clipboard.length > 1 && (
                                <Fragment>
                                    <Divider />
                                    <CardActions disableSpacing>
                                        <Button size="small" color="primary" onClick={this.onDeleteAll}>
                                            Delete All
                                        </Button>
                                    </CardActions>
                                </Fragment>
                            )}
                        </Card>
                    </Popover>
                )}
            </Fragment>
        )
    }
}

export default compose(withStyles(styles))(ComponentClipboard)
