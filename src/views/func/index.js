/*
 * Created by Jim McAndrew on 2/5/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import * as Dronelink from "dronelink-kernel"
import FuncVersions from "./versions"
import FuncSourceComponents from "./sourcecomponents"
import { LinearProgress, Drawer, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Popover } from "@material-ui/core"
import Moment from "react-moment"
import { FuncEditor } from "react-dronelink"
import { DeleteForeverOutlined as DeleteIcon } from "@material-ui/icons"
import { History as VersionsIcon, ContentSaveAll as CopyIcon } from "mdi-material-ui"
import { withFirebase } from "../../components/firebase"
import ComponentSelect from "../component/select"
import moment from "moment"

const styles = theme => ({
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

class FuncViewerBase extends Component {
    state = {
        func: null,
        funcVersion: null,
        versions: false,
        sourceComponents: false,
        sourceComponentsUpdatesAvailableCount: 0,
        addComponentAnchorEl: null
    }

    componentDidMount() {
        const { firebase, funcContent } = this.props

        if (funcContent) {
            this.setState({
                func: funcContent
            })
            return
        }

        if (!firebase) {
            this.setState({
                func: false
            })
            return
        }

        this.unsubscribeFunc = this.funcRef().onSnapshot(snapshot => {
            if (this.unmounted) {
                return
            }

            if (!snapshot.exists) {
                this.setState({
                    func: false
                })
                return
            }

            if (!this.unsubscribeFuncVersion) {
                this.funcVersionsRef = firebase.funcVersions(snapshot.id)
                this.unsubscribeFuncVersion = firebase.funcLatestVersion(snapshot.id).onSnapshot(snapshot => {
                    if (this.unmounted || snapshot.metadata.hasPendingWrites) {
                        return
                    }

                    if (snapshot.empty) {
                        this.funcVersionRef = null
                        this.onClose()
                        return
                    }

                    const doc = snapshot.docs[0]
                    this.funcVersionRef = this.funcVersionsRef.doc(doc.id)
                    const funcVersion = { ...{ id: doc.id }, ...doc.data() }
                    const func = Dronelink.Serialization.read(funcVersion.content)

                    if (func) {
                        if (this.funcVersionDelta && this.funcVersionDelta === funcVersion.delta) {
                            return
                        }

                        this.setState({
                            func: func,
                            funcVersion: funcVersion
                        })
                    } else {
                        window.notificationWidget.showAlertDialog({
                            title: `Unable to read Function`,
                            content: `Do you want to delete this Function`,
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

                firebase.touchFunc(this.funcRef())
            }
        })
    }

    componentWillUnmount() {
        this.unmounted = true

        if (this.unsubscribeFunc) {
            this.unsubscribeFunc()
        }

        if (this.unsubscribeFuncVersion) {
            this.unsubscribeFuncVersion()
        }
    }

    funcRef = () => {
        const { firebase, funcID } = this.props
        return firebase.func(funcID)
    }

    onChange = replacementFunc => {
        const { firebase } = this.props
        if (!firebase) {
            return
        }

        let { func, funcVersion } = this.state
        func = replacementFunc || func

        const finish = newVersion => {
            if (!newVersion) {
                funcVersion.locked = null
            }

            this.funcVersionDelta = newVersion ? null : Dronelink.Common.uuid()
            this.setState({
                autosaved: new Date(),
                func: func
            })
            firebase.updateFunc(this.funcRef(), func, newVersion ? null : this.funcVersionRef, this.funcVersionDelta)
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

        if (funcVersion.locked) {
            window.notificationWidget.showAlertDialog({
                title: "Start Editing",
                content: "Continue editing the current version or create a new version?",
                onDismiss: () => {
                    //cancel the changes
                    this.setState({
                        func: Dronelink.Serialization.read(funcVersion.content)
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
        const copiedFunc = this.state.func
        this.setState({ copyAnchorEl: null })
        const func = Dronelink.Serialization.clone(copiedFunc, true)
        func.descriptors.name = `Copy of ${func.descriptors.name}`
        const docRef = firebase.func()
        firebase
            .createFunc(docRef, func, this.funcRef())
            .then(() => {
                window.notificationWidget.showSnackbar(`Copied ${copiedFunc.descriptors.name}`)
                onOpen(docRef.id)
            })
            .catch(e => {
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onVersion = () => {
        this.funcVersionDelta = null
        this.props.firebase.updateFunc(this.funcRef(), this.state.func).then(() => {
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
        this.setState(state => ({
            versions: !state.versions
        }))
    }

    onAcceptSourceComponents = func => {
        this.funcVersionDelta = null
        return this.props.firebase.updateFunc(this.funcRef(), func).then(() => {
            window.notificationWidget.showSnackbar({
                message: "Updates Accepted"
            })
        })
    }

    onSourceComponentsUpdatesAvailable = count => {
        if (!this.state.sourceComponents && count > 0) {
            window.notificationWidget.showSnackbar({
                message: count === 1 ? "Updates available for 1 included component." : `Updates available for ${Dronelink.Format.integer(count)} included components.`,
                action: {
                    title: "View",
                    onClick: this.onSourceComponentsToggle
                }
            })
        }

        this.setState({
            sourceComponentsUpdatesAvailableCount: count
        })
    }

    onSourceComponentsToggle = () => {
        this.setState(state => ({
            sourceComponents: !state.sourceComponents
        }))
    }

    onDelete = force => {
        const { firebase } = this.props
        const finish = () => {
            firebase.deleteFunc(this.funcRef()).catch(e => {
                window.notificationWidget.showSnackbar(`Unable to delete: ${e.message}`)
            })
        }

        if (force === true) {
            finish()
            return
        }

        window.notificationWidget.showAlertDialog({
            title: `Delete Function`,
            content: `Are you sure you want to permanently delete this Function?`,
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
        if (firebase && this.funcVersionRef && !this.state.funcVersion.locked) {
            firebase.lockFuncVersion(this.funcVersionRef)
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

    onAddComponentToggle = e => {
        this.setState({ addComponentAnchorEl: e ? e.currentTarget : null })
    }

    onAddComponent = component => {
        const { func } = this.state
        const { firebase } = this.props

        this.setState({ addComponentAnchorEl: null })

        if (!component) {
            return
        }

        firebase
            .componentLatestVersion(component.data().type, component.id)
            .get()
            .then(componentVersion => {
                if (componentVersion.empty) {
                    return
                }
                const newComponent = Dronelink.Serialization.clone(Dronelink.Serialization.read(componentVersion.docs[0].data().content), true)
                newComponent.source = new Dronelink.ComponentSource(component.ref.path, new Dronelink.Datetime(component.data().updated.toDate()))
                firebase.incrementComponentIncludes(component.ref)
                func.components.push(newComponent)
                this.onChange()
            })
    }

    render() {
        const { firebase, classes, onOpen, onClose } = this.props
        const { func, funcVersion, autosaved, versions, sourceComponents, sourceComponentsUpdatesAvailableCount, addComponentAnchorEl } = this.state

        if (func === false) {
            return (
                <Dialog open>
                    <DialogTitle style={{ paddingBottom: 0 }}>Page Invalid</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="textSecondary">
                            Unable to find this function
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

        if (func === null) {
            return <LinearProgress className={classes.loading} />
        }

        return (
            <Fragment>
                <div className={classes.editor}>
                    <FuncEditor
                        func={func}
                        subtitle={
                            funcVersion && {
                                tooltip: `Last Saved ${moment(autosaved || funcVersion.updated.toDate()).format("MMM D, YYYY [at] h:mm:ss a")}`,
                                value: autosaved ? <Moment format="h:mm:ss a" date={autosaved} /> : <Moment format="MMM D, YYYY" date={funcVersion.updated.toDate()} />
                            }
                        }
                        onAddComponent={firebase ? this.onAddComponentToggle : undefined}
                        onChange={this.onChange}
                        menuItems={this.getMenuItems()}
                        sourceComponents={firebase ? { onOpen: this.onSourceComponentsToggle, updatesAvailableCount: sourceComponentsUpdatesAvailableCount } : undefined}
                        onClose={this.onClose}
                    />
                </div>
                {firebase && (
                    <Fragment>
                        {addComponentAnchorEl && (
                            <Popover
                                open
                                anchorEl={addComponentAnchorEl}
                                onClose={() => {
                                    this.onAddComponentToggle()
                                }}
                            >
                                <ComponentSelect onSelect={this.onAddComponent} />
                            </Popover>
                        )}
                        <Drawer open={versions} onClose={this.onVersionsToggle}>
                            <div className={classes.versions}>
                                <FuncVersions funcVersionsRef={this.funcVersionsRef} onCreate={this.onVersion} onOpen={onOpen} onClose={this.onVersionsToggle} />
                            </div>
                        </Drawer>
                        <Drawer open={sourceComponents} onClose={this.onSourceComponentsToggle} keepMounted>
                            <FuncSourceComponents
                                background={!sourceComponents}
                                func={func}
                                onUpdatesAvailable={this.onSourceComponentsUpdatesAvailable}
                                onAccept={this.onAcceptSourceComponents}
                                onChange={this.onChange}
                                onClose={this.onSourceComponentsToggle}
                            />
                        </Drawer>
                    </Fragment>
                )}
            </Fragment>
        )
    }
}

const FuncViewer = compose(withStyles(styles), withFirebase)(FuncViewerBase)
export { FuncViewer }
