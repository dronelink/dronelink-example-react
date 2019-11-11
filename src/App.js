/*
 * Created by Jim McAndrew on 11/4/2019
 *
 * Copyright (c) 2019 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import * as Dronelink from "dronelink-kernel"
import "typeface-roboto"
import { ComponentEditor, MapWidget, NotificationWidget, MissionUtils } from "react-dronelink"
import { MuiThemeProvider, createMuiTheme, withStyles } from "@material-ui/core/styles"
import { emphasize } from "@material-ui/core/styles/colorManipulator"
import { deepPurple as ColorPrimary, pink as ColorSecondary } from "@material-ui/core/colors"
import CssBaseline from "@material-ui/core/CssBaseline"
import { Dialog, Button, DialogContent } from "@material-ui/core"

MissionUtils.UI.headerHeight = 64

const themes = {
    light: createMuiTheme({
        palette: {
            primary: {
                main: ColorPrimary[900]
            },
            secondary: ColorSecondary
        }
    }),
    dark: createMuiTheme({
        palette: {
            type: "dark",
            primary: {
                main: emphasize(ColorPrimary[900], 0.85)
            },
            secondary: ColorSecondary
        }
    })
}

const styles = theme => ({
    main: {
        position: "fixed",
        top: MissionUtils.UI.headerHeight,
        left: 0,
        bottom: 0
    },
    action: {
        marginBottom: theme.spacing(2)
    }
})

class App extends Component {
    state = {
        mapModal: false,
        mapStyle: null,
        component: null
    }

    onMapLoaded = style => {
        this.setState({ mapStyle: style })
    }

    onMapModal = enabled => {
        this.setState({ mapModal: enabled })
    }

    onImport = e => {
        const file = e.target.files[0]
        const reader = new FileReader()
        reader.onloadend = e => {
            const component = Dronelink.Serialization.read(reader.result)
            if (component) {
                this.setState({ component: Dronelink.Serialization.clone(component, true) })
                return
            }
            window.notificationWidget.showSnackbar("Unable to import: " + file.name)
        }
        reader.readAsText(file)
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
        const list = new Dronelink.ListComponent()
        plan.rootComponent = list

        //fly to a destination at 100 meters
        const destination = new Dronelink.DestinationComponent()
        list.childComponents.push(destination)
        destination.descriptors = new Dronelink.Descriptors("Example Destination")
        destination.destinationOffset = new Dronelink.Vector2(0, 100)
        destination.altitudeRange.altitude = new Dronelink.Altitude(100.0)
        //only allow horizontal motion when within +/- 5 meters of the target altitude (100 meters)
        destination.altitudeRange.range = new Dronelink.Limits(5.0, -5.0)
        //achieved when within 3 meters horizontally and 1 meter vertically for 1 second
        destination.achievementTime = 1.0
        destination.achievementDistance = new Dronelink.DistanceTolerance(3.0, 1.0)
        //set up the camera on the way to the destination
        const destinationCameraSettings = new Dronelink.ListComponent()
        destination.immediateComponent = destinationCameraSettings
        destinationCameraSettings.childComponents.push(new Dronelink.CommandComponent(new Dronelink.StopCaptureCameraCommand()))
        const cameraModeCommand = new Dronelink.ModeCameraCommand()
        cameraModeCommand.mode = Dronelink.CameraMode.Photo
        destinationCameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraModeCommand))
        let cameraPhotoModeCommand = new Dronelink.PhotoModeCameraCommand()
        cameraPhotoModeCommand.photoMode = Dronelink.CameraPhotoMode.Single
        destinationCameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoModeCommand))
        //take a picture at the destionation
        destination.achievedComponent = new Dronelink.CommandComponent(new Dronelink.StartCaptureCameraCommand())

        //perform an orbit that spirals downward and outward 4 times from 100 to 30 meters
        const orbit = new Dronelink.OrbitComponent()
        list.childComponents.push(orbit)
        orbit.descriptors = new Dronelink.Descriptors("Example Orbit")
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
        const orbitCameraSettings = new Dronelink.ListComponent()
        orbit.approachComponent.immediateComponent = orbitCameraSettings
        cameraPhotoModeCommand = new Dronelink.PhotoModeCameraCommand()
        cameraPhotoModeCommand.photoMode = Dronelink.CameraPhotoMode.Interval
        orbitCameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoModeCommand))
        const cameraPhotoIntervalCommand = new Dronelink.PhotoIntervalCameraCommand()
        cameraPhotoIntervalCommand.photoInterval = 2.0
        orbitCameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoIntervalCommand))
        //start the intervalometer once the approach has been achieved
        orbit.approachComponent.achievedComponent = new Dronelink.CommandComponent(new Dronelink.StartCaptureCameraCommand())

        //stop the intervalometer after the orbit
        const command = new Dronelink.CommandComponent(new Dronelink.StopCaptureCameraCommand())
        command.descriptors = new Dronelink.Descriptors("Example Command")
        list.childComponents.push(command)

        //focus on a point-of-interest while flying along waypoints
        const path = new Dronelink.PathComponent()
        list.childComponents.push(path)
        path.descriptors = new Dronelink.Descriptors("Example Path")
        path.approachComponent.destinationOffset = new Dronelink.Vector2(Math.PI, 200)
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
        path.addMarker(marker)
        marker = new Dronelink.PathComponentMarker()
        marker.distance = 200
        marker.altitude = new Dronelink.Altitude(100.0)
        marker.interpolation.f = Dronelink.InterpolationFunction.Sigmoid
        path.addMarker(marker)

        //capture a map
        const map = new Dronelink.MapComponent()
        list.childComponents.push(map)
        map.descriptors = new Dronelink.Descriptors("Example Map")
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

        this.setState({ component: plan })
    }

    onChange = replacementComponent => {
        this.setState(state => ({ component: replacementComponent || state.component }))
    }

    onClose = () => {
        this.setState({ component: null })
    }

    render() {
        const { classes } = this.props
        const { mapModal, mapStyle, component } = this.state
        return (
            <MuiThemeProvider theme={themes.light}>
                <CssBaseline />
                <NotificationWidget />
                <MapWidget onLoaded={this.onMapLoaded} onModal={this.onMapModal}></MapWidget>
                {mapStyle && (
                    <Fragment>
                        <Dialog open={!component}>
                            <DialogContent>
                                <Fragment>
                                    <input type="file" id="import" style={{ display: "none" }} onChange={this.onImport} />
                                    <label htmlFor="import">
                                        <Button className={classes.action} component="span" color="primary" variant="contained" fullWidth>
                                            Import Plan
                                        </Button>
                                    </label>
                                </Fragment>
                                <Button className={classes.action} variant="contained" fullWidth onClick={this.onGenerate}>
                                    Generate Plan
                                </Button>
                            </DialogContent>
                        </Dialog>
                        {component && (
                            //using the map style as a key to give down-stream users a chance to re-add layers when it changes
                            <main key={mapStyle} className={classes.main} style={mapModal ? { display: "none" } : undefined}>
                                <ComponentEditor component={component} onChange={this.onChange} onClose={this.onClose} />
                            </main>
                        )}
                    </Fragment>
                )}
            </MuiThemeProvider>
        )
    }
}

export default withStyles(styles)(App)
