/*
 * Created by Jim McAndrew on 11/4/2019
 *
 * Copyright (c) 2019 Dronelink, LLC
 */
import React, { Component } from "react"
import * as Dronelink from "dronelink-kernel"
import "typeface-roboto"
import { MapWidget, NotificationWidget, ComponentUtils, Utils, ComponentEditor } from "react-dronelink"
import { MuiThemeProvider, createMuiTheme, withStyles } from "@material-ui/core/styles"
import { emphasize } from "@material-ui/core/styles/colorManipulator"
import { deepPurple as ColorPrimary, pink as ColorSecondary } from "@material-ui/core/colors"
import CssBaseline from "@material-ui/core/CssBaseline"
import Navigation from "./views/navigation"
import Repository from "./views/repository"
import { Dialog, DialogTitle, DialogContent, Button } from "@material-ui/core"

Utils.UI.headerHeight = 64

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
        top: Utils.UI.headerHeight,
        left: 0,
        bottom: 0
    },
    editor: {
        "pointer-events": "none",
        position: "absolute",
        width: "100vw",
        height: "100%"
    }
})

class App extends Component {
    constructor(props) {
        super(props)
        this.state = {
            themeName: localStorage.getItem("theme.name") || "light",
            mapModal: false,
            mapStyle: null,
            component: null
        }

        Dronelink.Format.UnitSystem = localStorage.getItem("unitSystem") || Dronelink.UnitSystem.Imperial
    }

    setTheme = name => {
        localStorage.setItem("theme.name", name)
        //Force page reload instead of: this.setState({ themeName: name })
        //because mapbox styles get wonky....
        window.location.reload()
    }

    setUnitSystem = unitSystem => {
        localStorage.setItem("unitSystem", unitSystem)
        Dronelink.Format.UnitSystem = unitSystem
        this.forceUpdate()
    }

    onMapLoaded = style => {
        this.setState({ mapStyle: style })
    }

    onMapModal = enabled => {
        this.setState({ mapModal: enabled })
    }

    onFullExample = () => {
        this.setState({ component: false })
    }

    onCreate = () => {
        ComponentUtils.createPlan(plan => {
            this.setState({ component: plan, configurationWizard: true })
        })
    }

    onChange = replacementComponent => {
        //replacementComponent will only be set on undo/redo
        this.setState(state => ({
            component: replacementComponent || state.component
        }))
    }

    onClose = () => {
        const mission = Dronelink.Mission.createFromComponent(this.state.component)
        const estimateSummary = mission.estimate(
            true, //altitude required
            true //time required
        ).summary
        console.log(
            Dronelink.Common.joinNotEmpty([
                `Time: ${Dronelink.Format.timeElapsed(estimateSummary.time).toString()}`,
                `Distance: ${Dronelink.Format.distance(estimateSummary.distance).toString()}`,
                `Max Speed: ${Dronelink.Format.velocityHorizontal(estimateSummary.horizontalVelocityMax).toString()}`,
                `Max Altitude: ${Dronelink.Format.altitude(estimateSummary.altitude.max).toString()}`,
                `Photos: ${Dronelink.Format.integer(estimateSummary.photos).toString()}`,
                `Videos: ${Dronelink.Format.integer(estimateSummary.videos).toString()}`
            ])
        )
        this.setState({ component: null })
    }

    render() {
        const { classes } = this.props
        const { mapModal, mapStyle, component } = this.state
        return (
            <MuiThemeProvider theme={themes[this.state.themeName]}>
                <CssBaseline />
                <NotificationWidget />
                <MapWidget onLoaded={this.onMapLoaded} onModal={this.onMapModal}></MapWidget>
                <Navigation setUnitSystem={this.setUnitSystem} setTheme={this.setTheme} themeName={this.state.themeName} />
                {mapStyle && ( //using the map style as a key to give down-stream users a chance to re-add layers when it changes
                    <main key={mapStyle} className={classes.main} style={mapModal ? { display: "none" } : undefined}>
                        <Dialog open={!mapModal && component === null}>
                            <DialogTitle>Welcome to the Dronelink Example!</DialogTitle>
                            <DialogContent>
                                <Button variant="contained" color="primary" fullWidth onClick={this.onFullExample}>
                                    See full example
                                </Button>
                                <Button fullWidth color="primary" onClick={this.onCreate}>
                                    Just create a plan
                                </Button>
                            </DialogContent>
                        </Dialog>
                        {component === false && <Repository />}
                        {component !== false && component !== null && (
                            <div className={classes.editor}>
                                <ComponentEditor component={component} configurationWizard onChange={this.onChange} onClose={this.onClose} />
                            </div>
                        )}
                    </main>
                )}
            </MuiThemeProvider>
        )
    }
}

export default withStyles(styles)(App)
