/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import Moment from "react-moment"
import { withStyles } from "@material-ui/core/styles"
import { TextField, InputAdornment, Button, Typography, Card, CardContent, CardActionArea, CardHeader, Avatar, LinearProgress, Popover, Tooltip } from "@material-ui/core"
import { Search as FilterIcon, Add as AddIcon, KeyboardArrowRight as ViewIcon, CloudUpload as ImportIcon } from "@material-ui/icons"
import { Link as IncludeIcon, LightbulbOnOutline as EmptyIcon } from "mdi-material-ui"
import PlanPinImage from "../../assets/img/plan-pin.png"
import SubComponentPinImage from "../../assets/img/component-pin.png"
import { MapUtils, MapMarkerCollection, ComponentImportFileDialog } from "react-dronelink"
import * as Dronelink from "dronelink-kernel"
import { ComponentUtils, DescriptorsTags, ComponentAddWizard } from "react-dronelink"
import mapboxgl from "mapbox-gl"
import { isMobile } from "react-device-detect"
import { withFirebase } from "../../components/firebase"
import Firebase from "../../components/firebase/firebase"
import Utils from "../../components/utils"

const styles = theme => ({
    container: {
        width: "100%",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        padding: theme.spacing(2)
    },
    createContent: {
        display: "flex",
        alignItems: "center",
        alignContent: "center",
        flexDirection: "column"
    },
    component: {
        padding: 0,
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        width: "100%"
    },
    content: {
        paddingTop: 0,
        paddingBottom: theme.spacing(1)
    },
    avatar: {
        backgroundColor: theme.palette.primary.main
    },
    detail: {
        marginTop: theme.spacing(0.5),
        marginBottom: theme.spacing(0.5),
        display: "flex",
        alignItems: "center"
    },
    detailSpacer: {
        marginRight: theme.spacing(1.5)
    },
    detailIcon: {
        marginRight: theme.spacing(0.5)
    },
    import: {
        display: "flex",
        alignItems: "center"
    },
    action: {
        display: "flex",
        alignItems: "center"
    },
    actions: {
        justifyContent: "space-between",
        padding: 0,
        minHeight: 40
    },
    viewIcon: {
        marginTop: theme.spacing(1),
        marginRight: theme.spacing(1)
    },
    planMarker: MapUtils.markerCSSPin(PlanPinImage),
    subComponentMarker: MapUtils.markerCSSPin(SubComponentPinImage),
    progress: {
        width: "100%"
    },
    empty: {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        marginRight: theme.spacing(1),
        marginTop: theme.spacing(2)
    },
    emptyIcon: {
        marginRight: theme.spacing(1)
    }
})

class ComponentsBase extends Component {
    state = {
        components: null,
        creating: false,
        filter: null,
        limit: 100,
        importFile: null
    }

    markers = new MapMarkerCollection()

    componentDidMount() {
        const { firebase, componentType } = this.props
        if (!firebase) {
            this.setState({
                components: false
            })
            return
        }

        this.unsubscribeComponents = firebase.components(componentType).onSnapshot(snapshot => {
            if (snapshot.metadata.hasPendingWrites) {
                return
            }

            const components = Firebase.sortDocsByDate(snapshot.docs, "touched")

            this.markers.refresh(
                components.length,
                index => {
                    const component = components[index]
                    const marker = MapUtils.elementMarkerPin(
                        this.props.markerClassName,
                        false,
                        null,
                        () => {
                            window.mapWidget.onHoverMarker()
                            this.props.onOpen(component.id, componentType)
                        },
                        e => {
                            window.mapWidget.onHoverMarker(e, () => {
                                return component.data().name
                            })
                        }
                    )
                    marker.setLngLat([component.data().coordinate.longitude, component.data().coordinate.latitude])
                    return marker
                },
                (marker, index) => {
                    const component = components[index]
                    marker.setLngLat([component.data().coordinate.longitude, component.data().coordinate.latitude])
                }
            )

            this.setState({
                components: components
            })

            const plans = components.filter(component => {
                return component.data().type === Dronelink.TypeName.PlanComponent
            })
            if (plans.length > 0) {
                const bounds = new mapboxgl.LngLatBounds()
                plans.forEach(plan => {
                    bounds.extend([plan.data().coordinate.longitude, plan.data().coordinate.latitude])
                })
                window.mapWidget.map.fitBounds(bounds, { padding: { top: 125, left: 425, right: 50, bottom: 50 }, maxZoom: 16, animate: false })
            }
        })
    }

    componentWillUnmount() {
        if (this.unsubscribeComponents) {
            this.unsubscribeComponents()
        }
        this.markers.removeAll()
    }

    onCreateComplete = component => {
        this.setState({ creating: true })
        const { firebase, onOpen } = this.props
        if (!firebase) {
            onOpen(component)
            return
        }

        const docRef = firebase.component(component.type)
        firebase
            .createComponent(docRef, component)
            .then(() => {
                window.mapWidget.map.flyTo({ center: component.coordinate.toLngLat(), zoom: Math.max(window.mapWidget.map.getZoom(), 17) })
                onOpen(docRef.id, component.type)
            })
            .catch(e => {
                this.setState({ creating: false })
                window.notificationWidget.showSnackbar(e.message)
            })
    }

    onImportToggle = e => {
        this.setState({ importFile: e ? e.target.files[0] : null })
        if (e) {
            //clear out the value in case they want to cancel (so onChange will fire again)
            e.target.value = ""
        }
    }

    onImport = component => {
        this.onImportToggle()
        this.onCreateComplete(Dronelink.Serialization.clone(component, true), true)
    }

    onLimitIncrease = () => {
        this.setState(state => ({
            limit: state.limit + 100
        }))
    }

    onFilter = e => {
        this.setState({ [e.target.name]: e.target.value })
    }

    results = () => {
        const { components, filter } = this.state
        if (components) {
            return components.filter(component => {
                return Utils.matchStrings(
                    filter,
                    [Dronelink.Serialization.typeDisplay(component.data().type), component.data().name, component.data().description].concat(component.data().tags)
                )
            })
        }
        return null
    }

    render() {
        const { classes, labels, onCreate, onOpen, emptyString } = this.props
        const { components, creating, filter, limit, importFile } = this.state

        const results = this.results()

        return (
            <div className={classes.container}>
                {results && (results.length > 0 || filter) && (
                    <TextField
                        name="filter"
                        autoComplete="off"
                        autoFocus={!isMobile}
                        fullWidth
                        margin="dense"
                        placeholder="Search"
                        value={filter || ""}
                        onChange={this.onFilter}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <FilterIcon color="action" />
                                </InputAdornment>
                            )
                        }}
                    />
                )}
                {onCreate && !filter && (
                    <Fragment>
                        <Card className={classes.component}>
                            <CardActionArea
                                onClick={e => {
                                    onCreate(e, this.onCreateComplete)
                                }}
                            >
                                <CardContent className={classes.createContent}>
                                    <AddIcon fontSize="large" color="primary" />
                                    <Typography color="primary" variant="button">
                                        New {labels.name}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                        {!creating && (
                            <div className={classes.import}>
                                <input type="file" id="import" style={{ display: "none" }} onChange={this.onImportToggle} />
                                <Tooltip title="Dronelink (lz, json), Google Earth (kml/kmz), Litchi (csv)">
                                    <label htmlFor="import">
                                        <Button component="span" color="primary" size="small">
                                            <ImportIcon style={{ marginRight: 8 }} /> Import
                                        </Button>
                                    </label>
                                </Tooltip>
                                <Tooltip title="Dronelink (lz, json), Google Earth (kml/kmz), Litchi (csv)">
                                    <Typography variant="caption" color="textSecondary" style={{ marginLeft: 5 }}>
                                        Dronelink, Google Earth, Litchi...
                                    </Typography>
                                </Tooltip>
                            </div>
                        )}
                    </Fragment>
                )}
                {(creating || components === null) && <LinearProgress className={classes.progress} />}
                {results &&
                    results
                        .filter((value, index) => {
                            return index < limit
                        })
                        .map(component => {
                            return (
                                <Card key={component.id} className={classes.component}>
                                    <CardActionArea
                                        onClick={() => {
                                            onOpen(component.id, component.type)
                                        }}
                                    >
                                        <CardHeader
                                            avatar={<Avatar className={classes.avatar}>{ComponentUtils.getIcon(component.data().type)}</Avatar>}
                                            title={component.data().name}
                                            subheader={<Moment format="lll" date={component.data().updated.toDate()} />}
                                            action={<ViewIcon color="action" className={classes.viewIcon} />}
                                        />
                                        <CardContent className={classes.content}>
                                            {component.data().description && (
                                                <div className={classes.detail}>
                                                    <Typography variant="body2">{component.data().description}</Typography>
                                                </div>
                                            )}
                                            <div className={classes.detail}>
                                                {component.data().details && (
                                                    <Fragment>
                                                        {component.data().details.subComponents > 0 && (
                                                            <Fragment>
                                                                {ComponentUtils.getIcon(Dronelink.TypeName.Component, classes.detailIcon, "small", "action")}
                                                                <Typography variant="body2" color="textSecondary">
                                                                    {Dronelink.Format.integer(component.data().details.subComponents, {
                                                                        singular: Dronelink.Strings.Component.name,
                                                                        plural: Dronelink.Strings.Component.multiple
                                                                    })}
                                                                </Typography>
                                                            </Fragment>
                                                        )}
                                                    </Fragment>
                                                )}
                                            </div>
                                            {component.data().includes > 0 && (
                                                <div className={classes.detail}>
                                                    <IncludeIcon className={classes.detailIcon} fontSize="small" color="action" />
                                                    <Typography variant="body2" color="textSecondary">
                                                        {`Included ${Dronelink.Format.integer(component.data().includes, { singular: "time", plural: "times" })}`}
                                                    </Typography>
                                                </div>
                                            )}
                                            {component.data().tags && (
                                                <div className={classes.detail}>
                                                    <DescriptorsTags descriptors={component.data()} />
                                                </div>
                                            )}
                                        </CardContent>
                                    </CardActionArea>
                                </Card>
                            )
                        })}
                {components && components.length === 0 && onCreate && (
                    <div className={classes.empty}>
                        <EmptyIcon className={classes.emptyIcon} color="action" />
                        <Typography variant="subtitle2">{emptyString}</Typography>
                    </div>
                )}
                {results && results.length > limit && (
                    <Button fullWidth color="primary" size="small" onClick={this.onLimitIncrease}>
                        Show More
                    </Button>
                )}
                {importFile && (
                    <ComponentImportFileDialog
                        file={importFile}
                        onImport={this.onImport}
                        onClose={() => {
                            this.onImportToggle()
                        }}
                    />
                )}
            </div>
        )
    }
}

const Components = compose(withFirebase)(ComponentsBase)

class PlansBase extends Component {
    onCreate = (e, complete) => {
        ComponentUtils.createPlan(complete)
    }

    render() {
        const { classes } = this.props

        return (
            <Components
                {...this.props}
                onCreate={this.onCreate}
                labels={Dronelink.Strings.PlanComponent}
                componentType={Dronelink.TypeName.PlanComponent}
                markerClassName={classes.planMarker}
                emptyString="Plans are collections of one or more components that you can run as a mission. Most plans are designed for a specific location."
            />
        )
    }
}

const Plans = compose(withStyles(styles))(PlansBase)
export { Plans }

class SubComponentsBase extends Component {
    state = {
        selecting: null
    }

    onCreate = (e, complete) => {
        this.setState({ selecting: { anchorEl: e.currentTarget, complete: complete } })
    }

    onSelectComponent = component => {
        if (!component) {
            this.setState({ selecting: null })
            return
        }

        const { selecting } = this.state
        this.setState({ selecting: null })

        component.descriptors.name = `New ${component.title}`
        selecting.complete(component)
    }

    render() {
        const { selecting } = this.state
        const { classes } = this.props

        return (
            <Fragment>
                {selecting && (
                    <Popover
                        open={!window.mapWidget.modal}
                        anchorEl={selecting.anchorEl}
                        onClose={() => {
                            this.onSelectComponent()
                        }}
                    >
                        <ComponentAddWizard
                            title={`New ${Dronelink.Strings.Component.name}`}
                            componentAllowed={component => {
                                return !(component instanceof Dronelink.CommandComponent)
                            }}
                            onSelect={this.onSelectComponent}
                        />
                    </Popover>
                )}
                <Components
                    {...this.props}
                    onCreate={this.onCreate}
                    labels={Dronelink.Strings.Component}
                    componentType={Dronelink.TypeName.SubComponent}
                    markerClassName={classes.subComponentMarker}
                    emptyString="Components are building blocks for plans. Most components are designed to work for multiple locations as they can be included in many different plans."
                />
            </Fragment>
        )
    }
}

const SubComponents = compose(withStyles(styles))(SubComponentsBase)

export { SubComponents }
