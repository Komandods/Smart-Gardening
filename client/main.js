// main.js - Einstiegspunkt des Frontends
import m from "mithril";
import Dashboard from "./Dashboard";
import Details from "./Details";
import Notizen from "./Notizen";
import Settings from "./Settings";


import "./styles.css";

const Navigation = {
    view: () => {
        return m("nav", { class: "main-nav" }, [
            m("a", { href: "#/dashboard" }, "Aktuelles"),
            m("a", { href: "#/details" }, "Statistiken"),
            //m("a", { href: "#/notizen" }, "Notizen"),
            m("a", { href: "#/settings" }, "Einstellungen"),
        ]);
    },
};

// Hauptlayout
const Layout = {
    view: (vnode) => {
        return m("div", { class: "layout" }, [
            m("header", { class: "main-header" }, [m("h1", "Smart Gardening Dashboard")]),
            m(Navigation),
            m("main", vnode.children),
            m("footer", { class: "main-footer" }, ""),
        ]);
    },
};

// Routen
m.route(document.body, "/dashboard", {
    "/dashboard": {
        render: () => m(Layout, m(Dashboard)),
    },
    "/details": {
        render: () => m(Layout, m(Details)),
    },

    "/settings": {
        render: () => m(Layout, m(Settings)),
    },
});
