(function () {
    "use strict";

    var appView = Windows.UI.ViewManagement.ApplicationView;
    var app = WinJS.Application;
    var nav = WinJS.Navigation;
    var ui = WinJS.UI;

    function onLoaded() {
        var webview = document.getElementById("webview");
        if (webview) {
            webview.addEventListener("MSWebViewNavigationCompleted", function (e) {
                document.title = "mStore";
            });
        }
    }

    document.addEventListener("DOMContentLoaded", onLoaded, false);

    WinJS.Namespace.define("mStore", {
        navigate: function (url) {
            var webview = document.getElementById("webview");
            if (webview) webview.navigate(url);
        }
    });
})();
