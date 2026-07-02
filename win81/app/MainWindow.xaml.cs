using System.Windows;
namespace mStore {
    public partial class MainWindow : Window {
        public MainWindow() {
            InitializeComponent();
            browser.Navigate("https://mstores.45.38.143.196.nip.io");
        }
    }
}
