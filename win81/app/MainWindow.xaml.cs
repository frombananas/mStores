using System;
using System.Windows;
using Microsoft.Win32;

namespace mStore {
    public partial class MainWindow : Window {
        public MainWindow() {
            SetBrowserEmulation();
            InitializeComponent();
            browser.Navigate("https://mstores.45.38.143.196.nip.io");
        }

        static void SetBrowserEmulation() {
            try {
                var key = Registry.CurrentUser.OpenSubKey(
                    @"Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION", true);
                if (key == null)
                    key = Registry.CurrentUser.CreateSubKey(
                        @"Software\Microsoft\Internet Explorer\Main\FeatureControl\FEATURE_BROWSER_EMULATION");
                key.SetValue("mStore.exe", 11001, RegistryValueKind.DWord);
                key.Close();
            } catch { }
        }
    }
}
