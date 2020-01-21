/*
 * Created by Jim McAndrew on 1/21/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import * as Dronelink from "dronelink-kernel"
import Moment from "react-moment"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import { withFirebase } from "../../components/firebase"
import { IconButton, Button, LinearProgress, Avatar, Typography, Divider, Card, CardHeader, CardActions, Tooltip } from "@material-ui/core"
import { Close as RejectIcon, Done as AcceptIcon } from "@material-ui/icons"
import { Link as SourceIcon, LinkOff as UnlinkIcon } from "mdi-material-ui"
import { NodeUtils } from "react-dronelink"

const styles = theme => ({
    container: {
        padding: theme.spacing(2),
        minWidth: 350
    },
    header: {
        display: "flex",
        alignItems: "center",
        padding: `${theme.spacing(1)}px ${theme.spacing(1)}px ${theme.spacing(1)}px ${theme.spacing(2)}px`,
        backgroundColor: theme.palette.background.default
    },
    loadingContainer: {
        minHeight: 50
    },
    icon: {
        marginRight: theme.spacing(1)
    },
    grow: {
        flexGrow: 1
    },
    card: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2)
    },
    actions: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1)
    },
    actionIcon: {
        marginRight: theme.spacing(1)
    },
    spacer: {
        margin: theme.spacing(2)
    }
})

class ComponentSourceComponents extends Component {
    background = true
    state = {
        sources: null,
        accepting: false
    }

    componentDidMount() {
        this.updateSourcesStart()
    }

    componentWillUnmount() {
        this.unmounted = true
    }

    updateSourcesStart = () => {
        this.setState({
            sources: null,
            accepting: false
        })

        const { firebase, component } = this.props
        this.getComponents(
            component
                .node()
                .descendants.filter(descendant => {
                    return descendant instanceof Dronelink.ComponentNode && descendant.component.source
                })
                .map(descendant => {
                    return { node: descendant, ref: firebase.firestore.doc(descendant.component.source.path), component: null }
                })
        )
    }

    getComponents = sources => {
        if (sources.length === 0) {
            this.setState({
                sources: false
            })
            return
        }

        return Promise.all(
            sources.map(source => {
                return source.ref.get()
            })
        ).then(componentDocs => {
            if (this.unmounted) {
                return
            }

            componentDocs.forEach((componentDoc, index) => {
                sources[index].component = componentDoc.exists ? componentDoc : null
            })

            sources.forEach(source => {
                source.accessible = source.component
                source.updateAvailable =
                    source.accessible &&
                    source.component
                        .data()
                        .updated.toDate()
                        .getTime() > source.node.component.source.updated.value.getTime()
            })

            this.getComponentLatestVersions(sources)
        })
    }

    getComponentLatestVersions = sources => {
        const { firebase } = this.props
        const sourcesUpdatesAvailable = sources.filter(source => {
            return source.updateAvailable
        })

        if (sourcesUpdatesAvailable.length === 0) {
            this.updateSourcesFinish(sources)
            return
        }

        Promise.all(
            sourcesUpdatesAvailable.map(source => {
                return firebase.componentLatestVersion(source.component.data().type, source.component.id).get()
            })
        ).then(versions => {
            if (this.unmounted) {
                return
            }

            versions.forEach((snapshot, index) => {
                const source = sourcesUpdatesAvailable[index]
                if (snapshot.empty) {
                    source.updateAvailable = false
                } else {
                    source.update = Dronelink.Serialization.read(snapshot.docs[0].data().content)
                }
            })

            this.updateSourcesFinish(sources)
        })
    }

    updateSourcesFinish = sources => {
        if (this.unmounted) {
            return
        }

        const { onUpdatesAvailable } = this.props
        if (onUpdatesAvailable) {
            onUpdatesAvailable(
                sources.filter(source => {
                    return source.updateAvailable
                }).length
            )
        }

        this.setState({
            sources: sources
        })
    }

    onUnlink = source => {
        window.notificationWidget.showAlertDialog({
            title: `Unlink ${Dronelink.Strings.Component.name}`,
            content: "Unlinking will prevent further updates. Are you sure you want to unlink this component?",
            actions: [
                {
                    title: "Unlink",
                    color: "secondary",
                    onClick: () => {
                        source.node.component.source = null
                        this.props.onChange()
                        this.updateSourcesStart()
                    }
                }
            ]
        })
    }

    onAccept = sources => {
        window.notificationWidget.showAlertDialog({
            title: "Accept Updates",
            content: "Are you sure you want to accept these updates? The changes will be copied into a new version in case you need to roll-back.",
            actions: [
                {
                    title: sources.length > 1 ? "Accept All" : "Accept",
                    color: "primary",
                    onClick: () => {
                        this.setState({ accepting: true })

                        const { component, onAccept } = this.props
                        const context = Dronelink.Mission.createFromComponent(component).context
                        const rootNode = component.node()
                        sources.forEach(source => {
                            //grab the latest node (in case the props component was updated out from under us since we generated the update list)
                            const node = rootNode.findDescendant(source.node.id)
                            if (node) {
                                let repositionCoordinate = null
                                if (node.component.repositionIfIncluded) {
                                    const referenceOffsets = node.component.node().referenceOffsets
                                    if (referenceOffsets.length > 0) {
                                        repositionCoordinate = node.component.referenceCoordinate(context, referenceOffsets[0])
                                    }
                                }

                                //keep descriptors
                                const descriptors = Dronelink.Serialization.serialize(node.component.descriptors)
                                node.component.applyJSON(Dronelink.Serialization.plainJSON(Dronelink.Serialization.clone(source.update, true)))
                                node.component.descriptors.applyJSON(descriptors)

                                //possibly reposition again
                                if (repositionCoordinate) {
                                    node.component.reposition(repositionCoordinate, context)
                                }

                                node.component.source = new Dronelink.ComponentSource(source.component.ref.path, new Dronelink.Datetime(source.component.data().updated.toDate()))
                            }
                        })

                        onAccept(component)
                            .then(() => {
                                this.updateSourcesStart()
                            })
                            .catch(e => {
                                window.notificationWidget.showSnackbar(e.message)
                                this.setState({ accepting: false })
                            })
                    }
                }
            ]
        })
    }

    onReject = sources => {
        window.notificationWidget.showAlertDialog({
            title: "Reject Updates",
            content: "Are you sure you want to reject these updates?",
            actions: [
                {
                    title: sources.length > 1 ? "Reject All" : "Reject",
                    color: "secondary",
                    onClick: () => {
                        sources.forEach(source => {
                            source.node.component.source.updated = new Dronelink.Datetime()
                        })
                        this.props.onChange()
                        this.updateSourcesStart()
                    }
                }
            ]
        })
    }

    getSourcesList = (title, filter) => {
        let { sources } = this.state
        if (!sources) {
            return null
        }

        sources = filter ? sources.filter(filter) : sources
        if (sources.length === 0) {
            return null
        }

        const { classes, onChange } = this.props
        const readonly = !onChange
        return (
            <Fragment>
                {title && (
                    <Typography variant="subtitle2" color="textSecondary">
                        {title}
                    </Typography>
                )}
                {sources.length > 1 && sources[0].updateAvailable && (
                    <Card className={classes.card}>
                        <CardActions disableSpacing>
                            <Button
                                size="small"
                                color="primary"
                                onClick={() => {
                                    this.onAccept(sources)
                                }}
                            >
                                <AcceptIcon className={classes.actionIcon} />
                                Accept All
                            </Button>
                            <Button
                                size="small"
                                color="secondary"
                                onClick={() => {
                                    this.onReject(sources)
                                }}
                            >
                                <RejectIcon className={classes.actionIcon} />
                                Reject All
                            </Button>
                        </CardActions>
                    </Card>
                )}
                {sources.map(source => {
                    return (
                        <Card key={source.node.id} className={classes.card}>
                            <CardHeader
                                avatar={<Avatar>{NodeUtils.getIcon(source.node)}</Avatar>}
                                action={
                                    readonly ? null : (
                                        <Tooltip title="Unlink">
                                            <IconButton
                                                onClick={() => {
                                                    this.onUnlink(source)
                                                }}
                                            >
                                                <UnlinkIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    )
                                }
                                title={Dronelink.Common.joinNotEmpty(
                                    NodeUtils.getPathAncestors(source.node)
                                        .map(ancestor => {
                                            return NodeUtils.getTitle(ancestor)
                                        })
                                        .concat([NodeUtils.getTitle(source.node)]),
                                    " / "
                                )}
                                subheader={
                                    <Moment format="MMM D, YYYY [at] h:mm:ss a" date={source.accessible ? source.component.data().updated.toDate() : source.node.component.source.updated.value} />
                                }
                            />
                            {!readonly && source.updateAvailable && (
                                <Fragment>
                                    <Divider />
                                    <CardActions disableSpacing>
                                        <Button
                                            size="small"
                                            color="primary"
                                            onClick={() => {
                                                this.onAccept([source])
                                            }}
                                        >
                                            <AcceptIcon className={classes.actionIcon} />
                                            Accept
                                        </Button>
                                        <Button
                                            size="small"
                                            color="secondary"
                                            onClick={() => {
                                                this.onReject([source])
                                            }}
                                        >
                                            <RejectIcon className={classes.actionIcon} />
                                            Reject
                                        </Button>
                                    </CardActions>
                                </Fragment>
                            )}
                        </Card>
                    )
                })}
                <div className={classes.spacer} />
            </Fragment>
        )
    }

    render() {
        const { sources, accepting } = this.state
        const { classes, onChange, onClose, background } = this.props
        if (!background && this.background) {
            setTimeout(this.updateSourcesStart, 0)
        }
        this.background = background
        const readonly = !onChange
        const loading = sources === null || accepting

        return (
            <Fragment>
                <div className={classes.header}>
                    <SourceIcon color="action" className={classes.icon} />
                    <Typography variant="body2">Included Components</Typography>
                    <div className={classes.grow} />
                    <Button size="small" color="primary" onClick={onClose}>
                        Done
                    </Button>
                </div>
                <div className={classes.container}>
                    {loading && (
                        <div className={classes.loadingContainer}>
                            <LinearProgress />
                        </div>
                    )}
                    {!loading && (
                        <Fragment>
                            {sources === false && (
                                <Typography variant="body2" color="textSecondary">
                                    No Included Components
                                </Typography>
                            )}
                            {readonly && this.getSourcesList()}
                            {!readonly && (
                                <Fragment>
                                    {this.getSourcesList("Updates Available", source => {
                                        return source.updateAvailable
                                    })}
                                    {this.getSourcesList("Source Components Unavailable", source => {
                                        return !source.accessible
                                    })}
                                    {this.getSourcesList("Up-to-Date", source => {
                                        return source.accessible && !source.updateAvailable
                                    })}
                                </Fragment>
                            )}
                        </Fragment>
                    )}
                </div>
            </Fragment>
        )
    }
}

export default compose(withStyles(styles), withFirebase)(ComponentSourceComponents)
