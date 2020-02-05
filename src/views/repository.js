/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component } from "react"
import { compose } from "recompose"
import { withStyles } from "@material-ui/core/styles"
import { Fade, Paper, Typography, AppBar, Tabs, Tab, IconButton, Tooltip } from "@material-ui/core"
import { Code as SubComponentIcon } from "@material-ui/icons"
import { ClipboardTextPlayOutline as PlanIcon, FolderOpenOutline as RepositoryIcon, DiceMultipleOutline as GenerateIcon, FunctionVariant as FuncIcon } from "mdi-material-ui"
import { Plans, SubComponents } from "./component/components"
import { Funcs } from "./func/funcs"
import { MissionUtils } from "react-dronelink"
import { ComponentViewer } from "./component"
import { FuncViewer } from "./func"
import * as Dronelink from "dronelink-kernel"
import { withFirebase } from "../components/firebase"

const styles = theme => ({
    container: {
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: MissionUtils.UI.headerHeight,
        left: 0,
        bottom: 0,
        [theme.breakpoints.up("sm")]: {
            width: 375,
            top: MissionUtils.UI.headerHeight + theme.spacing(2),
            left: theme.spacing(2),
            bottom: theme.spacing(2)
        },
        [theme.breakpoints.down("xs")]: {
            right: 0,
            top: MissionUtils.UI.headerHeight,
            left: 0,
            bottom: 0
        },
        backgroundColor: theme.palette.background.default
    },
    grow: {
        flexGrow: 1
    },
    overview: {
        width: "100%",
        height: 45,
        display: "flex",
        flexDirection: "column",
        padding: `${theme.spacing(1)}px ${theme.spacing(1)}px ${theme.spacing(0)}px ${theme.spacing(1)}px`,
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText
    },
    overviewRow: {
        display: "flex",
        alignItems: "center"
    },
    overviewText: {
        color: theme.palette.primary.contrastText
    },
    overviewIcon: {
        marginLeft: theme.spacing(1),
        marginRight: theme.spacing(1.5)
    },
    tab: {
        minWidth: 75
    },
    tabContent: {
        overflowY: "auto",
        "-webkit-overflow-scrolling": "touch"
    }
})

class Repository extends Component {
    state = {
        tab: 0,
        component: null,
        func: null
    }

    onTabChange = (event, tab) => {
        this.setState({
            tab: tab
        })
    }

    onOpenComponent = (component, componentType) => {
        this.setState({
            component: {
                type: componentType ? componentType : component.type,
                value: component
            }
        })
    }

    onOpenPlan = plan => {
        this.onOpenComponent(plan, Dronelink.TypeName.PlanComponent)
    }

    onOpenSubComponent = subComponent => {
        this.onOpenComponent(subComponent, Dronelink.TypeName.SubComponent)
    }

    onCloseComponent = () => {
        this.setState(state => ({
            tab: state.component && state.component.type === Dronelink.TypeName.SubComponent ? 1 : 0,
            component: null
        }))
    }

    onOpenFunc = func => {
        this.setState({
            func: func
        })
    }

    onCloseFunc = () => {
        this.setState(state => ({
            tab: state.func ? 2 : 0,
            func: null
        }))
    }

    render() {
        const { classes, firebase } = this.props
        const { tab, component, func } = this.state

        if (component) {
            const componentID = typeof component.value === "string" ? component.value : null
            const componentContent = typeof component.value === "object" ? component.value : null
            return (
                <ComponentViewer
                    key={componentID}
                    componentID={componentID}
                    componentContent={componentContent}
                    componentType={component.type}
                    onClose={this.onCloseComponent}
                    onOpen={this.onOpenComponent}
                />
            )
        }

        if (func) {
            const funcID = typeof func === "string" ? func : null
            const funcContent = typeof func === "object" ? func : null
            return <FuncViewer key={funcID} funcID={funcID} funcContent={funcContent} onClose={this.onCloseFunc} onOpen={this.onOpenFunc} />
        }

        return (
            <Fade in>
                <Paper className={classes.container} elevation={10}>
                    <AppBar position="relative" color="default">
                        <div className={classes.overview}>
                            <div className={classes.overviewRow}>
                                <RepositoryIcon className={classes.overviewIcon} />
                                <Typography className={classes.overviewText} variant="subtitle1" noWrap>
                                    {firebase ? firebase.root() : "Local State"}
                                </Typography>
                                <div className={classes.grow} />
                                <Tooltip title="Generate a cool plan...">
                                    <IconButton size="small" color="inherit" onClick={this.onGenerate}>
                                        <GenerateIcon />
                                    </IconButton>
                                </Tooltip>
                            </div>
                        </div>
                        <Tabs value={tab} onChange={this.onTabChange} indicatorColor="primary" textColor="primary" variant="fullWidth">
                            {<Tab icon={<PlanIcon />} className={classes.tab} />}
                            {<Tab icon={<SubComponentIcon />} className={classes.tab} />}
                            {<Tab icon={<FuncIcon />} className={classes.tab} />}
                        </Tabs>
                    </AppBar>
                    <div className={classes.tabContent}>
                        {tab === 0 && <Plans onOpen={this.onOpenPlan} />}
                        {tab === 1 && <SubComponents onOpen={this.onOpenSubComponent} />}
                        {tab === 2 && <Funcs onOpen={this.onOpenFunc} />}
                    </div>
                </Paper>
            </Fade>
        )
    }

    onGenerate = () => {
        //the plan is the root of every component heirarchy
        const plan = new Dronelink.PlanComponent()
        const context = new Dronelink.Context(plan)
        plan.descriptors = new Dronelink.Descriptors("Name", "Description", ["tag1", "tag2"])
        //the reference coordinate of the plan (all other positions/vectors are relative to this)
        plan.coordinate = window.mapWidget.getCenterMissionGeoCoordinate()
        //maximum speed of 5 m/s
        plan.droneMotionLimits.horizontal.velocity = new Dronelink.Limits(5.0)
        //require the drone to takeoff within 10 meters of plan.coordinate
        plan.takeoffOffset = new Dronelink.Vector2()
        plan.takeoffDistance = new Dronelink.DistanceTolerance(10.0)
        //activate RTH at the end of the mission (both success and failure)
        plan.completeAction = Dronelink.PlanCompleteAction.ReturnHome
        //plans can have any type of sub-component as the root component (List, Destination, Orbit, Path, Map, etc)
        plan.rootComponent = (() => {
            const list = new Dronelink.ListComponent()
            list.childComponents = [
                (() => {
                    //fly to a destination at 100 meters
                    const destination = new Dronelink.DestinationComponent()
                    destination.descriptors = new Dronelink.Descriptors("Example Destination")
                    destination.destinationOffset = new Dronelink.Vector2(0, 100)
                    destination.altitudeRange.altitude = new Dronelink.Altitude(100.0)
                    //only allow horizontal motion when within +/- 5 meters of the target altitude (100 meters)
                    destination.altitudeRange.range = new Dronelink.Limits(5.0, -5.0)
                    //achieved when within 3 meters horizontally and 1 meter vertically for 1 second
                    destination.achievementTime = 1.0
                    destination.achievementDistance = new Dronelink.DistanceTolerance(3.0, 1.0)
                    //set up the camera on the way to the destination
                    destination.immediateComponent = (() => {
                        const cameraSettings = new Dronelink.ListComponent()
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(new Dronelink.StopCaptureCameraCommand()))
                        const cameraModeCommand = new Dronelink.ModeCameraCommand()
                        cameraModeCommand.mode = Dronelink.CameraMode.Photo
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraModeCommand))
                        const cameraPhotoModeCommand = new Dronelink.PhotoModeCameraCommand()
                        cameraPhotoModeCommand.photoMode = Dronelink.CameraPhotoMode.Single
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoModeCommand))
                        return cameraSettings
                    })()
                    //take a picture at the destionation
                    destination.achievedComponent = new Dronelink.CommandComponent(new Dronelink.StartCaptureCameraCommand())
                    return destination
                })(),
                (() => {
                    //perform an orbit that spirals downward and outward 4 times from 100 to 30 meters
                    const orbit = new Dronelink.OrbitComponent()
                    orbit.descriptors = new Dronelink.Descriptors("Example Orbit")
                    orbit.assetSource = new Dronelink.AssetSource()
                    orbit.assetSource.descriptors.tags = ["Image Series"]
                    orbit.approachComponent.destinationOffset = new Dronelink.Vector2(Math.PI / 2, 200)
                    orbit.approachComponent.altitudeRange.altitude = new Dronelink.Altitude(100.0)
                    orbit.centerOffset = new Dronelink.Vector2(Math.PI / 2, 100)
                    orbit.direction = Dronelink.OrbitDirection.Clockwise
                    orbit.circumference = 4 * (2 * Math.PI)
                    orbit.finalAltitude = new Dronelink.Altitude(30.0)
                    orbit.finalRadius = 30.0
                    orbit.droneOrientation = new Dronelink.Orientation3Optional()
                    orbit.droneOrientation.yaw = Dronelink.Convert.degreesToRadians(90)
                    orbit.droneOrientation.yawReference = Dronelink.OrientationZReference.Path
                    const gimbalOrientation = new Dronelink.Orientation3Optional()
                    gimbalOrientation.pitch = Dronelink.Convert.degreesToRadians(-5)
                    gimbalOrientation.pitchReference = Dronelink.OrientationXReference.Horizon
                    orbit.gimbalOrientations = { 0: gimbalOrientation }
                    //set up the camera to take interval photos while approaching the orbit
                    orbit.approachComponent.immediateComponent = (() => {
                        const cameraSettings = new Dronelink.ListComponent()
                        const cameraPhotoModeCommand = new Dronelink.PhotoModeCameraCommand()
                        cameraPhotoModeCommand.photoMode = Dronelink.CameraPhotoMode.Interval
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoModeCommand))
                        const cameraPhotoFileFormatCommand = new Dronelink.PhotoFileFormatCameraCommand()
                        cameraPhotoFileFormatCommand.photoFileFormat = Dronelink.CameraPhotoFileFormat.JPEG
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoFileFormatCommand))
                        const cameraPhotoIntervalCommand = new Dronelink.PhotoIntervalCameraCommand()
                        cameraPhotoIntervalCommand.photoInterval = 2.0
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoIntervalCommand))
                        return cameraSettings
                    })()
                    //start the intervalometer once the approach has been achieved
                    orbit.approachComponent.achievedComponent = new Dronelink.CommandComponent(new Dronelink.StartCaptureCameraCommand())
                    return orbit
                })(),
                (() => {
                    //stop the intervalometer after the orbit
                    const command = new Dronelink.CommandComponent(new Dronelink.StopCaptureCameraCommand())
                    command.descriptors = new Dronelink.Descriptors("Example Command")
                    return command
                })(),
                (() => {
                    //focus on a point-of-interest while flying along waypoints
                    const path = new Dronelink.PathComponent()
                    path.descriptors = new Dronelink.Descriptors("Example Path")
                    path.assetSource = new Dronelink.AssetSource()
                    path.assetSource.descriptors.tags = ["Video"]
                    path.approachComponent.destinationOffset = new Dronelink.Vector2(Math.PI, 200)
                    path.approachComponent.immediateComponent = (() => {
                        const cameraSettings = new Dronelink.ListComponent()
                        const cameraModeCommand = new Dronelink.ModeCameraCommand()
                        cameraModeCommand.mode = Dronelink.CameraMode.Video
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraModeCommand))
                        const cameraVideoFileFormatCommand = new Dronelink.VideoFileFormatCameraCommand()
                        cameraVideoFileFormatCommand.videoFileFormat = Dronelink.CameraVideoFileFormat.MP4
                        cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraVideoFileFormatCommand))
                        return cameraSettings
                    })()
                    path.cornering = Dronelink.PathCornering.Intersect
                    const pointOfInterest = new Dronelink.PointOfInterest()
                    pointOfInterest.referencedOffset.coordinateOffset = new Dronelink.Vector2(Math.PI, 50)
                    path.pointsOfInterest.push(pointOfInterest)
                    const waypoint1 = new Dronelink.PathComponentWaypoint()
                    waypoint1.offset = new Dronelink.Vector2(Math.PI, 100)
                    path.addWaypoint(waypoint1, context)
                    const waypoint2 = new Dronelink.PathComponentWaypoint()
                    waypoint2.offset = new Dronelink.Vector2((3 * Math.PI) / 2, 100)
                    path.addWaypoint(waypoint2, context)
                    let marker = new Dronelink.PathComponentMarker()
                    marker.pointOfInterestID = pointOfInterest.id
                    marker.component = new Dronelink.CommandComponent(new Dronelink.StartCaptureCameraCommand())
                    path.addMarker(marker)
                    marker = new Dronelink.PathComponentMarker()
                    marker.distance = 200
                    marker.altitude = new Dronelink.Altitude(100.0)
                    marker.interpolation.f = Dronelink.InterpolationFunction.Sigmoid
                    marker.component = new Dronelink.CommandComponent(new Dronelink.StopCaptureCameraCommand())
                    path.addMarker(marker)
                    return path
                })(),
                (() => {
                    //capture a map
                    const map = new Dronelink.MapComponent()
                    map.descriptors = new Dronelink.Descriptors("Example Map")
                    map.assetSource = new Dronelink.AssetSource()
                    map.assetSource.descriptors.tags = ["Orthomosaic"]
                    map.droneMotionLimits = new Dronelink.MotionLimits6Optional()
                    map.droneMotionLimits.horizontal = new Dronelink.MotionLimitsOptional()
                    map.droneMotionLimits.horizontal.velocity = new Dronelink.Limits(10, 0)
                    map.approachComponent.altitudeRange.altitude.value = 30
                    map.cameraMode = Dronelink.CameraMode.Photo
                    map.minCaptureInterval = 2.0
                    map.pattern = Dronelink.MapPattern.Normal
                    map.frontOverlap = 0.8
                    map.sideOverlap = 0.7
                    const offset = new Dronelink.Vector2()
                    let boundaryPoint = new Dronelink.MapComponentBoundaryPoint()
                    boundaryPoint.offset = offset.add(new Dronelink.Vector2(-Math.PI / 4, 100))
                    map.addBoundaryPoint(boundaryPoint, context)
                    boundaryPoint = new Dronelink.MapComponentBoundaryPoint()
                    boundaryPoint.offset = offset.add(new Dronelink.Vector2(Math.PI / 4, 100))
                    map.addBoundaryPoint(boundaryPoint, context)
                    boundaryPoint = new Dronelink.MapComponentBoundaryPoint()
                    boundaryPoint.offset = offset.add(new Dronelink.Vector2(3 * (Math.PI / 4), 100))
                    map.addBoundaryPoint(boundaryPoint, context)
                    boundaryPoint = new Dronelink.MapComponentBoundaryPoint()
                    boundaryPoint.offset = offset.add(new Dronelink.Vector2(-(3 * (Math.PI / 4)), 100))
                    map.addBoundaryPoint(boundaryPoint, context)
                    return map
                })(),
                (() => {
                    //scan a facade
                    const facade = new Dronelink.FacadeComponent()
                    facade.descriptors = new Dronelink.Descriptors("Example Facade")
                    facade.droneMotionLimits = new Dronelink.MotionLimits6Optional()
                    facade.droneMotionLimits.horizontal = new Dronelink.MotionLimitsOptional()
                    facade.droneMotionLimits.horizontal.velocity = new Dronelink.Limits(10, 0)
                    facade.approachComponent.altitudeRange.altitude.value = 30
                    facade.targetDistance = 10
                    facade.initialAltitude.value = 30
                    facade.finalAltitude.value = 60
                    facade.cameraMode = Dronelink.CameraMode.Photo
                    facade.minCaptureInterval = 2.0
                    facade.pattern = Dronelink.FacadePattern.Horizontal
                    facade.capturePriority = Dronelink.FacadeCapturePriority.Distance
                    facade.boundaryFace = Dronelink.FacadeBoundaryFace.LineLeft
                    facade.verticalOverlap = 0.5
                    facade.horizontalOverlap = 0.5
                    const offset = new Dronelink.Vector2()
                    let boundaryPoint = new Dronelink.FacadeComponentBoundaryPoint()
                    boundaryPoint.offset = offset.add(new Dronelink.Vector2(-Math.PI / 4, 200))
                    facade.addBoundaryPoint(boundaryPoint, context)
                    boundaryPoint = new Dronelink.FacadeComponentBoundaryPoint()
                    boundaryPoint.offset = offset.add(new Dronelink.Vector2(Math.PI / 4, 200))
                    facade.addBoundaryPoint(boundaryPoint, context)
                    return facade
                })()
            ]
            return list
        })()

        const { firebase } = this.props
        if (firebase) {
            const docRef = firebase.component(plan.type)
            firebase
                .createComponent(docRef, plan)
                .then(() => {
                    window.mapWidget.map.flyTo({ center: plan.coordinate.toLngLat(), zoom: Math.max(window.mapWidget.map.getZoom(), 17) })
                    this.onOpenComponent(docRef.id, plan.type)
                })
                .catch(e => {
                    window.notificationWidget.showSnackbar(e.message)
                })
            return
        }

        this.onOpenComponent(plan)
    }
}

export default compose(withStyles(styles), withFirebase)(Repository)
