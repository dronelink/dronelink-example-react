/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import * as Dronelink from "dronelink-kernel"
import { MapUtils, ComponentEditor, ComponentUtils, Utils } from "react-dronelink"
import ComponentVersions from "./versions"
import ComponentSourceComponents from "./sourcecomponents"
import ComponentSelect from "./select"
import { LinearProgress, Drawer, Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from "@material-ui/core"
import Moment from "react-moment"
import { DeleteForeverOutlined as DeleteIcon, FileCopyOutlined as SubComponentCopyIcon } from "@material-ui/icons"
import { History as VersionsIcon, ContentSaveAll as CopyIcon, FolderPlusOutline as AddToRepositoryIcon, FolderOpenOutline as RepositoryIcon } from "mdi-material-ui"
import { withFirebase } from "../../components/firebase"
import ComponentClipboard from "./clipboard"
import ComponentPinImage from "../../assets/img/component-pin.png"
import moment from "moment"

const styles = theme => ({
    editor: {
        "pointer-events": "none",
        position: "absolute",
        width: "100vw",
        height: "100%"
    },
    loading: {
        width: "100vw"
    },
    versions: {
        minWidth: 300,
        maxWidth: 350
    }
})

class ComponentViewerBase extends Component {
    state = {
        component: null,
        componentVersion: null,
        versions: false,
        sourceComponents: false,
        sourceComponentsUpdatesAvailableCount: 0
    }

    componentDidMount() {
        const { firebase, componentContent, componentType } = this.props

        if (componentContent) {
            this.setState({
                component: componentContent
            })
            return
        }

        if (!firebase) {
            this.setState({
                component: false
            })
            return
        }

        this.unsubscribeComponent = this.componentRef().onSnapshot(snapshot => {
            if (this.unmounted) {
                return
            }

            if (!snapshot.exists) {
                this.setState({
                    component: false
                })
                return
            }

            if (!this.unsubscribeComponentVersion) {
                this.componentVersionsRef = firebase.componentVersions(componentType, snapshot.id)
                this.unsubscribeComponentVersion = firebase.componentLatestVersion(componentType, snapshot.id).onSnapshot(snapshot => {
                    if (this.unmounted || snapshot.metadata.hasPendingWrites) {
                        return
                    }

                    if (snapshot.empty) {
                        this.componentVersionRef = null
                        this.onClose()
                        return
                    }

                    const doc = snapshot.docs[0]
                    this.componentVersionRef = this.componentVersionsRef.doc(doc.id)
                    const componentVersion = { ...{ id: doc.id }, ...doc.data() }
                    const component = Dronelink.Serialization.read(componentVersion.content, error => {
                        console.log(error)
                    })
                    if (component) {
                        if (this.componentVersionDelta && this.componentVersionDelta === componentVersion.delta) {
                            return
                        }

                        this.setState({
                            component: component,
                            componentVersion: componentVersion
                        })
                    } else {
                        window.notificationWidget.showAlertDialog({
                            title: `Unable to read ${this.title()}`,
                            content: `Do you want to delete this ${this.title()}`,
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

                firebase.touchComponent(this.componentRef())
            }
        })
    }

    componentWillUnmount() {
        this.unmounted = true

        if (this.unsubscribeComponent) {
            this.unsubscribeComponent()
        }

        if (this.unsubscribeComponentVersion) {
            this.unsubscribeComponentVersion()
        }
    }

    componentRef = () => {
        const { firebase, componentType, componentID } = this.props
        return firebase.component(componentType, componentID)
    }

    title = () => {
        return Dronelink.Serialization.typeDisplay(this.props.componentType)
    }

    onChange = replacementComponent => {
        const { firebase } = this.props
        if (!firebase) {
            return
        }

        let { component, componentVersion } = this.state
        component = replacementComponent || component

        const finish = newVersion => {
            if (!newVersion) {
                componentVersion.locked = null
            }

            this.componentVersionDelta = newVersion ? null : Dronelink.Common.uuid()
            this.setState({
                autosaved: new Date(),
                component: component
            })
            firebase.updateComponent(this.componentRef(), component, newVersion ? null : this.componentVersionRef, this.componentVersionDelta)
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

        if (componentVersion.locked) {
            window.notificationWidget.showAlertDialog({
                title: "Start Editing",
                content: "Continue editing the current version or create a new version?",
                onDismiss: () => {
                    //cancel the changes
                    this.setState({
                        component: Dronelink.Serialization.read(componentVersion.content)
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
        const { firebase, componentType, onOpen } = this.props
        const copiedComponent = this.state.component
        this.setState({ copyAnchorEl: null })
        const component = Dronelink.Serialization.clone(copiedComponent, true)
        component.descriptors.name = `Copy of ${component.descriptors.name}`
        const docRef = firebase.component(componentType)
        firebase
            .createComponent(docRef, component, this.componentRef())
            .then(() => {
                window.notificationWidget.showSnackbar(`Copied ${copiedComponent.descriptors.name}`)
                onOpen(docRef.id, componentType)
            })
            .catch(e => {
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onVersion = () => {
        this.componentVersionDelta = null
        this.props.firebase.updateComponent(this.componentRef(), this.state.component).then(() => {
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

    onAcceptSourceComponents = component => {
        this.componentVersionDelta = null
        return this.props.firebase.updateComponent(this.componentRef(), component).then(() => {
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

    onSubComponentCopyToClipboard = (e, component) => {
        Utils.clipboard.push({
            created: new Date(),
            component: Dronelink.Serialization.clone(component, true)
        })
        window.notificationWidget.showSnackbar("Copied Component to the clipboard.")
        this.forceUpdate()
    }

    onSubComponentAddToRepository = (e, component) => {
        const newComponent = Dronelink.Serialization.clone(component, true)
        Object.assign(newComponent.coordinate, this.state.component.coordinate)
        if (!newComponent.descriptors.name) {
            newComponent.descriptors.name = `New ${component.title}`
        }
        const { firebase, onOpen } = this.props
        const docRef = firebase.component(newComponent.type)
        firebase
            .createComponent(docRef, newComponent)
            .then(() => {
                component.source = new Dronelink.ComponentSource(docRef.path, new Dronelink.Datetime())
                firebase.incrementComponentIncludes(docRef)
                this.onChange()

                window.notificationWidget.showSnackbar({
                    message: `Added ${newComponent.descriptors.name} to Repository`,
                    action: {
                        title: "View",
                        onClick: () => {
                            onOpen(docRef.id, Dronelink.TypeName.SubComponent)
                        }
                    }
                })
            })
            .catch(e => {
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onDelete = force => {
        const { firebase, componentType } = this.props
        const finish = () => {
            firebase.deleteComponent(this.componentRef(), componentType).catch(e => {
                window.notificationWidget.showSnackbar(`Unable to delete: ${e.message}`)
            })
        }

        if (force === true) {
            finish()
            return
        }

        window.notificationWidget.showAlertDialog({
            title: `Delete ${this.title()}`,
            content: `Are you sure you want to permanently delete this ${this.title()}?`,
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
        if (firebase && this.componentVersionRef && !this.state.componentVersion.locked) {
            firebase.lockComponentVersion(this.componentVersionRef)
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

    getSubComponentActions = () => {
        return {
            copy: {
                title: "Copy to Clipboard",
                icon: <SubComponentCopyIcon fontSize="small" />,
                onClick: this.onSubComponentCopyToClipboard
            },
            save: {
                title: "Add to Repository",
                icon: <AddToRepositoryIcon />,
                onClick: this.onSubComponentAddToRepository
            }
        }
    }

    addComponentFromSource = props => {
        const { firebase } = this.props
        const { onSelect, componentAllowed, context, coordinate, currentComponentID } = props
        return {
            title: "Include from Repository",
            description: "Include a Component from a Repository.",
            icon: <RepositoryIcon />,
            view: (
                <ComponentSelect
                    excludeComponentID={currentComponentID}
                    onSelect={component => {
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
                                if (componentAllowed && !componentAllowed(newComponent, true)) {
                                    window.notificationWidget.showSnackbar("Unable to include this type of component here.")
                                    return
                                }
                                newComponent.source = new Dronelink.ComponentSource(component.ref.path, new Dronelink.Datetime(component.data().updated.toDate()))
                                const finish = coordinate => {
                                    if (coordinate) {
                                        newComponent.reposition(coordinate, context)
                                        window.mapWidget.map.flyTo({ center: coordinate.toLngLat() })
                                    }
                                    firebase.incrementComponentIncludes(component.ref)
                                    onSelect(newComponent)
                                }
                                if (newComponent.repositionIfIncluded) {
                                    if (coordinate) {
                                        finish(coordinate)
                                    } else {
                                        window.mapWidget.showAddFeature(
                                            `Select a location for ${newComponent.title}`,
                                            coordinate => {
                                                if (!coordinate) {
                                                    onSelect()
                                                    return
                                                }
                                                finish(coordinate)
                                            },
                                            MapUtils.cursorImagePin(ComponentPinImage)
                                        )
                                    }
                                } else {
                                    finish()
                                }
                            })
                    }}
                />
            )
        }
    }

    render() {
        const { firebase, classes, onOpen, onClose } = this.props
        const { component, componentVersion, autosaved, versions, sourceComponents, sourceComponentsUpdatesAvailableCount } = this.state

        if (component === false) {
            return (
                <Dialog open>
                    <DialogTitle style={{ paddingBottom: 0 }}>Page Invalid</DialogTitle>
                    <DialogContent>
                        <Typography variant="body2" color="textSecondary">
                            Unable to find this {this.title()}
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

        if (component === null) {
            return <LinearProgress className={classes.loading} />
        }

        return (
            <div className={classes.editor}>
                <ComponentEditor
                    component={component}
                    configurationWizard={ComponentUtils.details(component).subComponents === 0}
                    subtitle={
                        componentVersion && {
                            tooltip: `Last Saved ${moment(autosaved || componentVersion.updated.toDate()).format("MMM D, YYYY [at] h:mm:ss a")}`,
                            value: autosaved ? <Moment format="h:mm:ss a" date={autosaved} /> : <Moment format="MMM D, YYYY" date={componentVersion.updated.toDate()} />
                        }
                    }
                    menuItems={this.getMenuItems()}
                    subComponentActions={this.getSubComponentActions()}
                    onChange={this.onChange}
                    onClose={this.onClose}
                    sourceComponents={firebase ? { onOpen: this.onSourceComponentsToggle, updatesAvailableCount: sourceComponentsUpdatesAvailableCount } : undefined}
                    addComponentFromSource={firebase ? this.addComponentFromSource : undefined}
                />
                <ComponentClipboard />
                {firebase && (
                    <Fragment>
                        <Drawer open={versions} onClose={this.onVersionsToggle}>
                            <div className={classes.versions}>
                                <ComponentVersions componentVersionsRef={this.componentVersionsRef} onCreate={this.onVersion} onOpen={onOpen} onClose={this.onVersionsToggle} />
                            </div>
                        </Drawer>
                        <Drawer open={sourceComponents} onClose={this.onSourceComponentsToggle} keepMounted>
                            <ComponentSourceComponents
                                background={!sourceComponents}
                                component={component}
                                onUpdatesAvailable={this.onSourceComponentsUpdatesAvailable}
                                onAccept={this.onAcceptSourceComponents}
                                onChange={this.onChange}
                                onClose={this.onSourceComponentsToggle}
                            />
                        </Drawer>
                    </Fragment>
                )}
            </div>
        )
    }
}

const ComponentViewer = compose(withStyles(styles), withFirebase)(ComponentViewerBase)
export { ComponentViewer }
