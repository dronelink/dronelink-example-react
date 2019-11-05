/*
 * Created by Jim McAndrew on 11/4/2019
 *
 * Copyright (c) 2019 Dronelink, LLC
 */
import React from "react"
import * as Dronelink from "dronelink-kernel"
import "typeface-roboto"
import { ComponentEditor, MapWidget, NotificationWidget, MissionUtils } from "react-dronelink"
import { MuiThemeProvider, createMuiTheme, withStyles } from "@material-ui/core/styles"
import { emphasize } from "@material-ui/core/styles/colorManipulator"
import { deepPurple as ColorPrimary, pink as ColorSecondary } from "@material-ui/core/colors"
import CssBaseline from "@material-ui/core/CssBaseline"

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
    }
})

class App extends React.Component {
    state = {
        mapModal: false,
        mapStyle: null,
        component: Dronelink.Serialization.read({
            id: "1bd6eed8-ab60-489e-bd6c-cc499afc363d",
            coordinate: { type: "GeoCoordinate", latitude: 30.267622946943575, longitude: -97.76592463802612 },
            descriptors: { type: "Descriptors", name: "Demo" },
            type: "PlanComponent",
            takeoffDistance: { type: "DistanceTolerance", horizontal: 6.096, vertical: 0 },
            droneMotionLimits: {
                type: "MotionLimits6",
                position: {
                    type: "MotionLimits3",
                    x: { type: "MotionLimits", velocity: { type: "Limits", max: 4.4704, min: 0 }, acceleration: { type: "Limits", max: 2.4384, min: -0.9144000000000001 } },
                    y: { type: "MotionLimits", velocity: { type: "Limits", max: 0, min: 0 }, acceleration: { type: "Limits", max: 0, min: 0 } },
                    z: { type: "MotionLimits", velocity: { type: "Limits", max: 3.048, min: -3.048 }, acceleration: { type: "Limits", max: 1.8288000000000002, min: -0.9144000000000001 } }
                },
                orientation: {
                    type: "MotionLimits3",
                    x: { type: "MotionLimits", velocity: { type: "Limits", max: 0, min: 0 }, acceleration: { type: "Limits", max: 0, min: 0 } },
                    y: { type: "MotionLimits", velocity: { type: "Limits", max: 0, min: 0 }, acceleration: { type: "Limits", max: 0, min: 0 } },
                    z: {
                        type: "MotionLimits",
                        velocity: { type: "Limits", max: 0.7853985000000001, min: -0.7853985000000001 },
                        acceleration: { type: "Limits", max: 0.17453300000000002, min: -0.17453300000000002 }
                    }
                }
            },
            rootComponent: {
                id: "fc172faa-f08d-4b29-9396-a80748829c88",
                coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                descriptors: { type: "Descriptors" },
                required: true,
                exclusive: false,
                reference: { id: "7c286b9b-df97-465b-8965-7179d2fbbb19", type: "SourcedGeoSpatial", source: "plan" },
                type: "ListComponent",
                childComponents: [
                    {
                        id: "8a6f1a25-4d15-4a20-9555-b98d9b1e007e",
                        coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                        descriptors: { type: "Descriptors" },
                        required: true,
                        exclusive: false,
                        reference: { id: "43229179-db41-4595-891b-d3ed69e3ec6a", type: "SourcedGeoSpatial", source: "plan" },
                        pointsOfInterest: [
                            {
                                id: "9ee7cc60-ef0a-4d2f-a6a4-920d84f8645c",
                                type: "PointOfInterest",
                                referencedOffset: {
                                    id: "0b9e2bbe-e3f1-4325-8dc2-c9b1aaf9cbd6",
                                    type: "GeoReferencedOffset",
                                    coordinateOffset: { type: "Vector2", direction: -1.6319577323729082, magnitude: 77.05531724323546 },
                                    altitudeOffset: 0
                                },
                                descriptors: { type: "Descriptors" }
                            },
                            {
                                id: "af9d8621-9ff1-44c3-8716-3283ea2be0bd",
                                type: "PointOfInterest",
                                referencedOffset: {
                                    id: "17faaecb-0e4e-499d-849c-549c59b953e8",
                                    type: "GeoReferencedOffset",
                                    coordinateOffset: { type: "Vector2", direction: -1.7924078075436272, magnitude: 122.63499196952178 },
                                    altitudeOffset: 0
                                },
                                descriptors: { type: "Descriptors" }
                            }
                        ],
                        droneMotionLimits: { type: "MotionLimits6Optional" },
                        approachComponent: {
                            id: "67c0d947-22ad-4504-bb90-3430cffe2562",
                            coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                            descriptors: { type: "Descriptors" },
                            required: true,
                            exclusive: false,
                            reference: { id: "cd63fec5-4be3-40b5-9107-4a758cb4e8f1", type: "SourcedGeoSpatial", source: "plan" },
                            droneMotionLimits: { type: "MotionLimits6Optional" },
                            immediateComponent: {
                                id: "88fec48f-6157-42d2-8fb2-2f56ebcab9e9",
                                coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                                descriptors: { type: "Descriptors" },
                                required: true,
                                exclusive: false,
                                reference: { id: "33ef652b-8281-4bba-b115-f14fec30d300", type: "SourcedGeoSpatial", source: "plan" },
                                type: "ListComponent",
                                childComponents: [
                                    {
                                        id: "3adc0d58-a862-4683-9f5f-d518f43a0fa9",
                                        coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                                        descriptors: { type: "Descriptors" },
                                        required: true,
                                        exclusive: false,
                                        reference: { id: "e339b21f-f123-4b5d-901f-17a16f337f44", type: "SourcedGeoSpatial", source: "plan" },
                                        type: "CommandComponent",
                                        command: { id: "7d7f9f18-d124-4d55-b5f2-0d3c103d5604", channel: 0, type: "StopCaptureCameraCommand" }
                                    },
                                    {
                                        id: "8c6f617e-fd1f-4b52-a6cc-2d4b7e498dc7",
                                        coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                                        descriptors: { type: "Descriptors" },
                                        required: true,
                                        exclusive: false,
                                        reference: { id: "805d8a12-c0d9-4f2f-8403-dac798b48fa7", type: "SourcedGeoSpatial", source: "plan" },
                                        type: "CommandComponent",
                                        command: { id: "3e5df66d-0eb1-4521-9932-e39c92b2bf52", channel: 0, type: "ModeCameraCommand", mode: "video" }
                                    }
                                ]
                            },
                            achievedComponent: {
                                id: "d9181805-7001-4a6b-842a-871752243825",
                                coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                                descriptors: { type: "Descriptors" },
                                required: true,
                                exclusive: false,
                                reference: { id: "d34c4f37-dab6-4f29-a282-1a07046e56bf", type: "SourcedGeoSpatial", source: "plan" },
                                type: "CommandComponent",
                                command: { id: "ada879ea-5373-4dbb-9fe8-4d2511ae2743", channel: 0, type: "StartCaptureCameraCommand" }
                            },
                            type: "DestinationComponent",
                            automaticOrientation: true,
                            destinationOffset: { type: "Vector2", direction: -2.462654957345719, magnitude: 7.198359022068819 },
                            altitudeRange: { type: "AltitudeRange", altitude: { type: "Altitude", system: "atl", value: 45.72 }, range: { type: "Limits", max: 4.572, min: -4.572 } },
                            achievementTime: 3,
                            achievementDistance: { type: "DistanceTolerance", horizontal: 3.048, vertical: 1.524 }
                        },
                        type: "PathComponent",
                        cornering: "intersect",
                        cornerRadius: 6.096,
                        waypoints: [
                            {
                                id: "b4f24a8e-3e1b-45e8-b508-d56a9eb261c7",
                                type: "PathComponentWaypoint",
                                offset: { type: "Vector2", direction: -1.0224537475149973, magnitude: 60.05407460710969 },
                                descriptors: { type: "Descriptors" }
                            },
                            {
                                id: "34fbdf98-b386-4fb8-b068-4380ff01e49b",
                                type: "PathComponentWaypoint",
                                offset: { type: "Vector2", direction: -1.5275223475684774, magnitude: 95.69634353127556 },
                                descriptors: { type: "Descriptors" }
                            },
                            {
                                id: "bd22802f-c70f-4846-b498-6afa7afe3ec4",
                                type: "PathComponentWaypoint",
                                offset: { type: "Vector2", direction: -2.1428094830988247, magnitude: 97.42645702342107 },
                                descriptors: { type: "Descriptors" }
                            },
                            {
                                id: "6a783290-f248-46be-9f49-80835f8839a6",
                                type: "PathComponentWaypoint",
                                offset: { type: "Vector2", direction: -2.6372494931287407, magnitude: 57.824905886601385 },
                                descriptors: { type: "Descriptors" }
                            },
                            {
                                id: "27262317-7c39-48aa-84fa-0e76c9fd4140",
                                type: "PathComponentWaypoint",
                                offset: { type: "Vector2", direction: -2.899726483579755, magnitude: 14.881075958573785 },
                                descriptors: { type: "Descriptors" }
                            }
                        ],
                        markers: [
                            {
                                id: "a58bfb10-8f26-4d37-b715-34cdf52762f8",
                                type: "PathComponentMarker",
                                positioning: "coordinate",
                                interpolation: { type: "Interpolation", f: "linear", sigmoidK: 2.718281828459045 },
                                droneMotionLimits: {
                                    type: "MotionLimits6Optional",
                                    position: { type: "MotionLimits3Optional", x: { type: "MotionLimitsOptional", velocity: { type: "Limits", max: 2.2352, min: 0 } } }
                                },
                                distance: 0
                            },
                            {
                                id: "eba04ffe-2314-47fc-8434-3449e4adf523",
                                type: "PathComponentMarker",
                                positioning: "coordinate",
                                interpolation: { type: "Interpolation", f: "linear", sigmoidK: 2.718281828459045 },
                                component: {
                                    id: "ae250e6a-9c50-4185-a4ec-2fdf7618ec5c",
                                    coordinate: { type: "GeoCoordinate", latitude: 0, longitude: 0 },
                                    descriptors: { type: "Descriptors" },
                                    required: true,
                                    exclusive: false,
                                    reference: { id: "63bcaf18-6bbd-4d54-a012-bd55d6c3799d", type: "SourcedGeoSpatial", source: "plan" },
                                    type: "ListComponent"
                                },
                                pointOfInterestID: "9ee7cc60-ef0a-4d2f-a6a4-920d84f8645c",
                                distance: 71.03656000530952
                            },
                            {
                                id: "e99c7d92-7560-4390-84d8-cf8a33283ae7",
                                type: "PathComponentMarker",
                                positioning: "coordinate",
                                interpolation: { type: "Interpolation", f: "linear", sigmoidK: 2.718281828459045 },
                                pointOfInterestID: "af9d8621-9ff1-44c3-8716-3283ea2be0bd",
                                distance: 144.67329585278966
                            }
                        ]
                    }
                ]
            },
            completeAction: "none"
        })
    }

    onMapLoaded = style => {
        this.setState({ mapStyle: style })
    }

    onMapModal = enabled => {
        this.setState({ mapModal: enabled })
    }

    onComponentChange = replacementComponent => {
        this.setState(state => ({ component: replacementComponent || state.component }))
    }

    onComponentClose = () => {}

    render() {
        const { classes } = this.props
        const { mapModal, mapStyle, component } = this.state
        return (
            <MuiThemeProvider theme={themes.light}>
                <CssBaseline />
                <NotificationWidget />
                <MapWidget onLoaded={this.onMapLoaded} onModal={this.onMapModal}></MapWidget>
                {mapStyle && (
                    //using the map style as a key to give down-stream users a chance to re-add layers when it changes
                    <main key={mapStyle} className={classes.main} style={mapModal ? { display: "none" } : undefined}>
                        <ComponentEditor component={component} onChange={this.onComponentChange} onClose={this.onComponentClose} />
                    </main>
                )}
            </MuiThemeProvider>
        )
    }
}

export default withStyles(styles)(App)
