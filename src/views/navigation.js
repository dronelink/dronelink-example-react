/*
 * Created by Jim McAndrew on 1/20/2020
 *
 * Copyright (c) 2020 Dronelink, LLC
 */
import React, { Component, Fragment } from "react"
import { compose } from "recompose"
import logoLightImage from "../assets/img/logo-light.png"
import { withStyles } from "@material-ui/core/styles"
import { Popover, Typography, Select, AppBar, Toolbar, List, ListItem, ListItemIcon, ListItemText, ListSubheader, FormControl, InputLabel, IconButton, Divider, Drawer } from "@material-ui/core"
import {
    Alert as OfflineIcon,
    Youtube as YoutubeIcon,
    Facebook as FacebookIcon,
    Instagram as InstagramIcon,
    Twitter as TwitterIcon,
    ForumOutline as ForumsIcon,
    School as TutorialsIcon,
    Github as DevelopersIcon
} from "mdi-material-ui"
import { HelpOutlineOutlined as SupportIcon, Menu as MenuIcon, Settings as SettingsIcon } from "@material-ui/icons"
import * as Dronelink from "dronelink-kernel"
import { Offline } from "react-detect-offline"
import { MissionUtils } from "react-dronelink"

const styles = (theme) => ({
    appBar: {
        [theme.breakpoints.up("sm")]: {
            background: "rgba(0, 0, 0, 0.75)"
        },
        [theme.breakpoints.down("xs")]: {
            background: "#000"
        },
        height: MissionUtils.UI.headerHeight
    },
    logoAppBarImage: {
        height: 30,
        [theme.breakpoints.down("xs")]: {
            marginTop: 5
        }
    },
    logoDrawerImageContainer: {
        backgroundColor: "#000",
        padding: `${theme.spacing(4)}px ${theme.spacing(4)}px ${theme.spacing(4)}px ${theme.spacing(3)}px`
    },
    logoDrawerImage: {
        height: 35
    },
    socialLinks: {
        display: "flex",
        justifyContent: "space-evenly",
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
        minHeight: 45
    },
    offline: {
        display: "flex",
        justifyContent: "center",
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: theme.spacing(0.5),
        backgroundColor: theme.palette.secondary.main
    },
    offlineIcon: {
        marginRight: theme.spacing(1)
    },
    settings: {
        minWidth: 200
    }
})

class Navigation extends Component {
    state = {
        settingsAnchorEl: null
    }

    constructor(props) {
        super(props)
        this.state = {
            menuOpen: JSON.parse(localStorage.getItem("navigation.menu.open") || "false")
        }
    }

    onDrawerToggle = () => {
        const menuOpen = !this.state.menuOpen
        localStorage.setItem("navigation.menu.open", menuOpen)
        this.setState({ menuOpen: menuOpen })
    }

    onSettingsToggle = (e) => {
        this.setState({ settingsAnchorEl: e ? e.currentTarget : null })
    }

    onThemeChange = (e) => {
        this.props.setTheme(e.target.value)
    }

    onUnitSystemChange = (e) => {
        this.props.setUnitSystem(e.target.value)
    }

    render() {
        const { classes, themeName } = this.props
        const { menuOpen, settingsAnchorEl } = this.state

        return (
            <Fragment>
                <AppBar position="fixed" className={classes.appBar}>
                    <Toolbar className={classes.toolbar}>
                        <IconButton className={classes.menuButton} color={themeName === "dark" ? "default" : "inherit"} onClick={this.onDrawerToggle}>
                            <MenuIcon />
                        </IconButton>
                        <img src={logoLightImage} alt="Dronelink" className={classes.logoAppBarImage} />
                    </Toolbar>
                    <Offline>
                        <div className={classes.offline}>
                            <OfflineIcon className={classes.offlineIcon} fontSize="small" />
                            <Typography color="inherit">Offline</Typography>
                        </div>
                    </Offline>
                </AppBar>
                <Drawer open={menuOpen} onClose={this.onDrawerToggle}>
                    <div className={classes.logoDrawerImageContainer}>
                        <a href={"https://dronelink.com/"} target="_blank" rel="noopener noreferrer">
                            <img src={logoLightImage} alt="Dronelink" className={classes.logoDrawerImage} />
                        </a>
                    </div>
                    <div className={classes.socialLinks}>
                        <IconButton
                            onClick={() => {
                                window.open("https://www.youtube.com/c/dronelink/", "_blank").focus()
                            }}
                        >
                            <YoutubeIcon fontSize="small" color="action" />
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                window.open("https://www.facebook.com/DronelinkHQ/", "_blank").focus()
                            }}
                        >
                            <FacebookIcon fontSize="small" color="action" />
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                window.open("https://www.instagram.com/dronelink/", "_blank").focus()
                            }}
                        >
                            <InstagramIcon fontSize="small" color="action" />
                        </IconButton>
                        <IconButton
                            onClick={() => {
                                window.open("https://twitter.com/DronelinkHQ/", "_blank").focus()
                            }}
                        >
                            <TwitterIcon fontSize="small" color="action" />
                        </IconButton>
                    </div>
                    <Divider />
                    <List>
                        <ListItem
                            button
                            onClick={() => {
                                window.open("https://support.dronelink.com/hc/en-us/articles/360025878173", "_blank").focus()
                            }}
                        >
                            <ListItemIcon>
                                <TutorialsIcon />
                            </ListItemIcon>
                            <ListItemText primary="Tutorials" />
                        </ListItem>
                        <ListItem
                            button
                            onClick={() => {
                                window.open("https://support.dronelink.com/hc/en-us/community/topics", "_blank").focus()
                            }}
                        >
                            <ListItemIcon>
                                <ForumsIcon />
                            </ListItemIcon>
                            <ListItemText primary="Forums" />
                        </ListItem>
                        <ListItem
                            button
                            onClick={() => {
                                window.open("https://support.dronelink.com/", "_blank").focus()
                            }}
                        >
                            <ListItemIcon>
                                <SupportIcon />
                            </ListItemIcon>
                            <ListItemText primary="Support" />
                        </ListItem>
                        <ListItem
                            button
                            onClick={() => {
                                window.open("https://github.com/dronelink/", "_blank").focus()
                            }}
                        >
                            <ListItemIcon>
                                <DevelopersIcon />
                            </ListItemIcon>
                            <ListItemText primary="Developers" />
                        </ListItem>
                        <ListItem button onClick={this.onSettingsToggle}>
                            <ListItemIcon>
                                <SettingsIcon />
                            </ListItemIcon>
                            <ListItemText primary="Settings" />
                        </ListItem>
                        <Divider />
                        <List dense>
                            <ListItem>
                                <ListItemText primary={process.env.REACT_APP_DISPLAY_NAME} secondary={`Version ${process.env.REACT_APP_VERSION}`} />
                            </ListItem>
                            <ListItem>
                                <ListItemText primary="Kernel" secondary={`Version ${Dronelink.Constants.Version}`} />
                            </ListItem>
                        </List>
                    </List>
                </Drawer>
                {settingsAnchorEl && (
                    <Popover
                        open
                        anchorEl={settingsAnchorEl}
                        onClose={() => {
                            this.onSettingsToggle()
                        }}
                    >
                        <List className={classes.settings} subheader={<ListSubheader disableSticky>Settings</ListSubheader>}>
                            <Divider />
                            <ListItem>
                                <FormControl fullWidth>
                                    <InputLabel shrink htmlFor="theme">
                                        Theme
                                    </InputLabel>
                                    <Select native value={themeName} onChange={this.onThemeChange} inputProps={{ id: "theme" }}>
                                        <option value="light">Light</option>
                                        <option value="dark">Dark</option>
                                    </Select>
                                </FormControl>
                            </ListItem>
                            <ListItem>
                                <FormControl fullWidth>
                                    <InputLabel shrink htmlFor="unitSystem">
                                        {Dronelink.Strings.UnitSystem.name}
                                    </InputLabel>
                                    <Select native value={Dronelink.Format.UnitSystem} onChange={this.onUnitSystemChange} inputProps={{ id: "unitSystem" }}>
                                        <option value={Dronelink.UnitSystem.Metric}>{Dronelink.Strings.UnitSystem.values.metric.name}</option>
                                        <option value={Dronelink.UnitSystem.Imperial}>{Dronelink.Strings.UnitSystem.values.imperial.name}</option>
                                    </Select>
                                </FormControl>
                            </ListItem>
                        </List>
                    </Popover>
                )}
            </Fragment>
        )
    }
}

export default compose(withStyles(styles))(Navigation)
