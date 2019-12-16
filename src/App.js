/*
 * Created by Jim McAndrew on 11/4/2019
 *
 * Copyright (c) 2019 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import * as Dronelink from "dronelink-kernel"
import "typeface-roboto"
import { ComponentEditor, MapWidget, NotificationWidget, MissionUtils, ComponentUtils, ComponentImportFileDialog } from "react-dronelink"
import { MuiThemeProvider, createMuiTheme, withStyles } from "@material-ui/core/styles"
import { emphasize } from "@material-ui/core/styles/colorManipulator"
import { deepPurple as ColorPrimary, pink as ColorSecondary } from "@material-ui/core/colors"
import CssBaseline from "@material-ui/core/CssBaseline"
import { Dialog, Button, DialogContent } from "@material-ui/core"
import { Share as ShareIcon } from "@material-ui/icons"
import FileSaver from "file-saver"

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
        marginBottom: theme.spacing(1)
    }
})

class App extends Component {
    state = {
        mapModal: false,
        mapStyle: null,
        importFile: null,
        configurationWizard: false,
        component: null
    }

    onMapLoaded = style => {
        this.setState({ mapStyle: style })
    }

    onMapModal = enabled => {
        this.setState({ mapModal: enabled })
    }

    onImportToggle = e => {
        this.setState({ importFile: e ? e.target.files[0] : null })
        if (e) {
            //clear out the value in case they want to cancel (so onChange will fire again)
            e.target.value = ""
        }
    }

    onImportFinish = component => {
        this.setState({
            importFile: null,
            component: Dronelink.Serialization.clone(component, true)
        })
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
            //fly to a destination at 100 meters
            const destination = new Dronelink.DestinationComponent()
            list.childComponents.push(destination)
            destination.descriptors = new Dronelink.Descriptors("Example Destination")
            destination.assetSource = new Dronelink.AssetSource()
            destination.assetSource.descriptors.tags = ["image"]
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

            //perform an orbit that spirals downward and outward 4 times from 100 to 30 meters
            const orbit = new Dronelink.OrbitComponent()
            list.childComponents.push(orbit)
            orbit.descriptors = new Dronelink.Descriptors("Example Orbit")
            orbit.assetSource = new Dronelink.AssetSource()
            orbit.assetSource.descriptors.tags = ["image_series"]
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
                const cameraPhotoIntervalCommand = new Dronelink.PhotoIntervalCameraCommand()
                cameraPhotoIntervalCommand.photoInterval = 2.0
                cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoIntervalCommand))
                const cameraPhotoFileFormatCommand = new Dronelink.PhotoFileFormatCameraCommand()
                cameraPhotoIntervalCommand.photoFileFormat = Dronelink.CameraPhotoFileFormat.JPEG
                cameraSettings.childComponents.push(new Dronelink.CommandComponent(cameraPhotoFileFormatCommand))
                return cameraSettings
            })()
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
            path.assetSource = new Dronelink.AssetSource()
            path.assetSource.descriptors.tags = ["video"]
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

            //capture a map
            const map = new Dronelink.MapComponent()
            list.childComponents.push(map)
            map.descriptors = new Dronelink.Descriptors("Example Map")
            map.assetSource = new Dronelink.AssetSource()
            map.assetSource.descriptors.tags = ["map"]
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
            return list
        })()

        this.setState({ component: plan })
    }

    onCreate = () => {
        ComponentUtils.createPlan(plan => {
            this.setState({ component: plan, configurationWizard: true })
        })
    }

    onChange = replacementComponent => {
        this.setState(state => ({
            component: replacementComponent || state.component
        }))
    }

    onClose = () => {
        this.setState({ component: null, configurationWizard: false })
    }

    onCustomMenuItem = e => {
        alert("Do something cool, like log the component json!")
        Dronelink.Serialization.WriteCompressByDefault = false //set this to write plain text vs compressed
        console.log(Dronelink.Serialization.write(this.state.component))
        //console.log(Dronelink.Serialization.serialize(this.state.component)) //use serialize directly to write plain text (ignoring WriteCompressByDefault)
    }

    getMenuItems = () => {
        const menuItems = []

        menuItems.push({
            title: "Custom Menu Item",
            icon: <ShareIcon />,
            onClick: this.onCustomMenuItem
        })

        return menuItems
    }

    render() {
        const { classes } = this.props
        const { mapModal, mapStyle, component, importFile, configurationWizard } = this.state
        return (
            <MuiThemeProvider theme={themes.light}>
                <CssBaseline />
                <NotificationWidget />
                <MapWidget onLoaded={this.onMapLoaded} onModal={this.onMapModal}></MapWidget>
                {mapStyle && (
                    <Fragment>
                        <Dialog open={!mapModal && !component && !importFile}>
                            <DialogContent>
                                <Fragment>
                                    <input type="file" id="import" style={{ display: "none" }} onChange={this.onImportToggle} />
                                    <label htmlFor="import">
                                        <Button className={classes.action} component="span" color="primary" variant="contained" fullWidth>
                                            Import
                                        </Button>
                                    </label>
                                </Fragment>
                                <Button className={classes.action} variant="contained" fullWidth onClick={this.onGenerate}>
                                    Generate
                                </Button>
                                <Button className={classes.action} fullWidth onClick={this.onCreate}>
                                    Create
                                </Button>
                            </DialogContent>
                        </Dialog>
                        {component && (
                            //using the map style as a key to give down-stream users a chance to re-add layers when it changes
                            <main key={mapStyle} className={classes.main} style={mapModal ? { display: "none" } : undefined}>
                                <ComponentEditor component={component} configurationWizard={configurationWizard} onChange={this.onChange} onClose={this.onClose} menuItems={this.getMenuItems()} />
                            </main>
                        )}
                        {importFile && (
                            <ComponentImportFileDialog
                                file={importFile}
                                onImport={this.onImportFinish}
                                onClose={() => {
                                    this.onImportToggle()
                                }}
                            />
                        )}
                    </Fragment>
                )}
            </MuiThemeProvider>
        )
    }
}

export default withStyles(styles)(App)
