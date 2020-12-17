/*
 * Created by Jim McAndrew on 11/6/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import * as Dronelink from "dronelink-kernel"
import ModeVersions from "./versions"
import { LinearProgress, Drawer, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@material-ui/core"
import Moment from "react-moment"
import { ModeEditor } from "react-dronelink"
import { DeleteForeverOutlined as DeleteIcon } from "@material-ui/icons"
import { History as VersionsIcon, ContentSaveAll as CopyIcon } from "mdi-material-ui"
import { withFirebase } from "../../components/firebase"
import moment from "moment"

const styles = (theme) => ({
    loading: {
        width: "100vw"
    },
    versions: {
        minWidth: 300,
        maxWidth: 350
    },
    editor: {
        "pointer-events": "none",
        position: "absolute",
        height: "100%",
        width: "100vw"
    }
})

class ModeViewerBase extends Component {
    state = {
        mode: null,
        modeVersion: null,
        versions: false
    }

    componentDidMount() {
        const { firebase, modeContent } = this.props

        if (modeContent) {
            this.setState({
                mode: modeContent
            })
            return
        }

        if (!firebase) {
            this.setState({
                mode: false
            })
            return
        }

        this.unsubscribeMode = this.modeRef().onSnapshot((snapshot) => {
            if (this.unmounted) {
                return
            }

            if (!snapshot.exists) {
                this.setState({
                    mode: false
                })
                return
            }

            if (!this.unsubscribeModeVersion) {
                this.modeVersionsRef = firebase.modeVersions(snapshot.id)
                this.unsubscribeModeVersion = firebase.modeLatestVersion(snapshot.id).onSnapshot((snapshot) => {
                    if (this.unmounted || snapshot.metadata.hasPendingWrites) {
                        return
                    }

                    if (snapshot.empty) {
                        this.modeVersionRef = null
                        this.onClose()
                        return
                    }

                    const doc = snapshot.docs[0]
                    this.modeVersionRef = this.modeVersionsRef.doc(doc.id)
                    const modeVersion = { ...{ id: doc.id }, ...doc.data() }
                    const mode = Dronelink.Serialization.read(modeVersion.content)

                    if (mode) {
                        if (this.modeVersionDelta && this.modeVersionDelta === modeVersion.delta) {
                            return
                        }

                        this.setState({
                            mode: mode,
                            modeVersion: modeVersion
                        })
                    } else {
                        window.notificationWidget.showAlertDialog({
                            title: `Unable to read Mode`,
                            content: `Do you want to delete this Mode`,
                            actions: [
                                {
                                    title: "Delete",
                                    color: "secondary",
                                    onClick: () => {
                                        this.onDelete(true)
                                    }
                                }
                            ]
                        })
                    }
                })

                firebase.touchMode(this.modeRef())
            }
        })
    }

    componentWillUnmount() {
        this.unmounted = true

        if (this.unsubscribeMode) {
            this.unsubscribeMode()
        }

        if (this.unsubscribeModeVersion) {
            this.unsubscribeModeVersion()
        }
    }

    modeRef = () => {
        const { firebase, modeID } = this.props
        return firebase.mode(modeID)
    }

    onChange = (replacementMode) => {
        const { firebase } = this.props
        if (!firebase) {
            return
        }

        let { mode, modeVersion } = this.state
        mode = replacementMode || mode

        const finish = (newVersion) => {
            if (!newVersion) {
                modeVersion.locked = null
            }

            this.modeVersionDelta = newVersion ? null : Dronelink.Common.uuid()
            this.setState({
                autosaved: new Date(),
                mode: mode
            })
            firebase.updateMode(this.modeRef(), mode, newVersion ? null : this.modeVersionRef, this.modeVersionDelta)
            if (newVersion) {
                window.notificationWidget.showSnackbar({
                    message: "Started New Version",
                    action: {
                        title: "View Versions",
                        onClick: this.onVersionsToggle
                    }
                })
            }
        }

        if (modeVersion.locked) {
            window.notificationWidget.showAlertDialog({
                title: "Start Editing",
                content: "Continue editing the current version or create a new version?",
                onDismiss: () => {
                    //cancel the changes
                    this.setState({
                        mode: Dronelink.Serialization.read(modeVersion.content)
                    })
                },
                actions: [
                    {
                        title: "Current Version",
                        color: "primary",
                        onClick: () => {
                            finish(false)
                        }
                    },
                    {
                        title: "New Version",
                        color: "default",
                        onClick: () => {
                            finish(true)
                        }
                    }
                ]
            })
        } else {
            finish(false)
        }
    }

    onCopy = () => {
        const { firebase, onOpen } = this.props
        const copiedMode = this.state.mode
        this.setState({ copyAnchorEl: null })
        const mode = Dronelink.Serialization.clone(copiedMode, true)
        mode.descriptors.name = `Copy of ${mode.descriptors.name}`
        const docRef = firebase.mode()
        firebase
            .createMode(docRef, mode, this.modeRef())
            .then(() => {
                window.notificationWidget.showSnackbar(`Copied ${copiedMode.descriptors.name}`)
                onOpen(docRef.id)
            })
            .catch((e) => {
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onVersion = () => {
        this.modeVersionDelta = null
        this.props.firebase.updateMode(this.modeRef(), this.state.mode).then(() => {
            window.notificationWidget.showSnackbar({
                message: "Started New Version",
                action: {
                    title: "View Versions",
                    onClick: this.onVersionsToggle
                }
            })

            this.onVersionsToggle()
        })
    }

    onVersionsToggle = () => {
        this.setState((state) => ({
            versions: !state.versions
        }))
    }

    onDelete = (force) => {
        const { firebase } = this.props
        const finish = () => {
            firebase.deleteMode(this.modeRef()).catch((e) => {
                window.notificationWidget.showSnackbar(`Unable to delete: ${e.message}`)
            })
        }

        if (force === true) {
            finish()
            return
        }

        window.notificationWidget.showAlertDialog({
            title: `Delete Mode`,
            content: `Are you sure you want to permanently delete this Mode?`,
            actions: [
                {
                    title: "Delete",
                    color: "secondary",
                    onClick: finish
                }
            ]
        })
    }

    onClose = () => {
        const { onClose, firebase } = this.props
        if (firebase && this.modeVersionRef && !this.state.modeVersion.locked) {
            firebase.lockModeVersion(this.modeVersionRef)
        }

        onClose()
    }

    getMenuItems = () => {
        return this.props.firebase
            ? [
                  {
                      title: "Versions",
                      icon: <VersionsIcon />,
                      onClick: this.onVersionsToggle
                  },
                  {
                      title: "Copy",
                      icon: <CopyIcon />,
                      onClick: this.onCopy
                  },
                  {
                      title: "Delete",
                      icon: <DeleteIcon />,
                      onClick: this.onDelete
                  }
              ]
            : null
    }

    render() {
        const { firebase, classes, onOpen, onClose } = this.props
        const { mode, modeVersion, autosaved, versions } = this.state

        if (mode === false) {
            return (
                <Dialog open>
                    <DialogTitle style={{ paddingBottom: 0 }}>Page Invalid</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="textSecondary">
                            Unable to find this Mode
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button color="primary" onClick={onClose}>
                            Dismiss
                        </Button>
                    </DialogActions>
                </Dialog>
            )
        }

        if (mode === null) {
            return <LinearProgress className={classes.loading} />
        }

        return (
            <Fragment>
                <div className={classes.editor}>
                    <ModeEditor
                        mode={mode}
                        subtitle={
                            modeVersion && {
                                tooltip: `Last Saved ${moment(autosaved || modeVersion.updated.toDate()).format("MMM D, YYYY [at] h:mm:ss a")}`,
                                value: autosaved ? <Moment format="h:mm:ss a" date={autosaved} /> : <Moment format="MMM D, YYYY" date={modeVersion.updated.toDate()} />
                            }
                        }
                        onChange={this.onChange}
                        menuItems={this.getMenuItems()}
                        onClose={this.onClose}
                    />
                </div>
                {firebase && (
                    <Fragment>
                        <Drawer open={versions} onClose={this.onVersionsToggle}>
                            <div className={classes.versions}>
                                <ModeVersions modeVersionsRef={this.modeVersionsRef} onCreate={this.onVersion} onOpen={onOpen} onClose={this.onVersionsToggle} />
                            </div>
                        </Drawer>
                    </Fragment>
                )}
            </Fragment>
        )
    }
}

const ModeViewer = compose(withStyles(styles), withFirebase)(ModeViewerBase)
export { ModeViewer }
