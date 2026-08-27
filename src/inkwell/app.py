import os
import sys
import json
import time
import sqlite3
from datetime import datetime, timezone, timedelta
import objc
import Quartz
from AppKit import (
    NSApplication,
    NSApp,
    NSStatusBar,
    NSVariableStatusItemLength,
    NSMenu,
    NSMenuItem,
    NSWorkspace,
    NSOpenPanel,
    NSModalResponseOK,
    NSAlert,
    NSInformationalAlertStyle,
    NSUserNotification,
    NSUserNotificationCenter,
    NSObject,
    NSApplicationActivationPolicyAccessory,
)
from Foundation import NSTimer, NSURL
from inkwell.diary import export_desktop_diary, export_to_obsidian_keylog, OUTPUT_PATH, DB_PATH

CONFIG_PATH = os.path.expanduser("~/.inkwell_config.json")

def load_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"vault_path": None, "paused": False}

def save_config(cfg: dict) -> None:
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"Error saving config: {e}")

def notify(title: str, text: str):
    try:
        notification = NSUserNotification.alloc().init()
        notification.setTitle_(title)
        notification.setInformativeText_(text)
        NSUserNotificationCenter.defaultUserNotificationCenter().deliverNotification_(notification)
    except Exception as e:
        print(f"Notification error: {e}")

class InkwellApp(NSObject):
    def init(self):
        self = objc.super(InkwellApp, self).init()
        if self is None:
            return None
        self.config = load_config()
        self.is_paused = self.config.get("paused", False)
        self.tap = None
        self.status_item = None
        self.permission_prompted = False
        self.init_db()
        return self

    def init_db(self):
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS keystrokes (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                app_name  TEXT,
                key_char  TEXT,
                key_code  INTEGER
            );
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ts ON keystrokes(timestamp);")
        conn.commit()
        conn.close()

    def applicationDidFinishLaunching_(self, notification):
        NSApp.setActivationPolicy_(NSApplicationActivationPolicyAccessory)
        # Create status item
        self.status_item = NSStatusBar.systemStatusBar().statusItemWithLength_(NSVariableStatusItemLength)
        self.update_menu()

    def update_menu(self):
        if not self.status_item:
            return

        button = self.status_item.button()
        if button:
            icon_text = "🖋️" if not self.is_paused else "🖋️⏸"
            button.setTitle_(icon_text)

        menu = NSMenu.alloc().init()

        # Title Item
        title_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Inkwell — Ambient Keystroke Journal", None, "")
        title_item.setEnabled_(False)
        menu.addItem_(title_item)

        # Status Item
        status_text = "● Logging Active" if not self.is_paused else "⏸ Logging Paused"
        status_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(status_text, None, "")
        status_item.setEnabled_(False)
        menu.addItem_(status_item)

        menu.addItem_(NSMenuItem.separatorItem())

        # Pause / Resume
        pause_label = "Pause Recording" if not self.is_paused else "Resume Recording"
        pause_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(pause_label, "togglePause:", "p")
        pause_item.setTarget_(self)
        menu.addItem_(pause_item)

        menu.addItem_(NSMenuItem.separatorItem())

        # Export Actions
        export_desk = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Generate Diary (Desktop)", "exportDesktop:", "d")
        export_desk.setTarget_(self)
        menu.addItem_(export_desk)

        vault_path = self.config.get("vault_path")
        obsidian_label = f"Sync to Obsidian Keylog ({os.path.basename(vault_path)})" if vault_path else "Sync to Obsidian Keylog"
        export_obs = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_(obsidian_label, "exportObsidian:", "s")
        export_obs.setTarget_(self)
        menu.addItem_(export_obs)

        set_vault = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Set Obsidian Vault Path...", "chooseVaultPath:", "v")
        set_vault.setTarget_(self)
        menu.addItem_(set_vault)

        menu.addItem_(NSMenuItem.separatorItem())

        # Clean DB
        clean_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Clean Database (Keep last 30 days)", "cleanDb:", "")
        clean_item.setTarget_(self)
        menu.addItem_(clean_item)

        # Reveal DB in Finder
        reveal_db = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Reveal inkwell.db in Finder", "revealDb:", "")
        reveal_db.setTarget_(self)
        menu.addItem_(reveal_db)

        menu.addItem_(NSMenuItem.separatorItem())

        # Quit
        quit_item = NSMenuItem.alloc().initWithTitle_action_keyEquivalent_("Quit Inkwell", "quitApp:", "q")
        quit_item.setTarget_(self)
        menu.addItem_(quit_item)

        self.status_item.setMenu_(menu)

    def togglePause_(self, sender):
        self.is_paused = not self.is_paused
        self.config["paused"] = self.is_paused
        save_config(self.config)
        self.update_menu()
        status = "paused" if self.is_paused else "resumed"
        notify("Inkwell", f"Keystroke recording {status}.")

    def exportDesktop_(self, sender):
        count = export_desktop_diary()
        notify("Inkwell Diary", f"Exported {count} sessions to Desktop.")
        NSWorkspace.sharedWorkspace().openFile_(OUTPUT_PATH)

    def exportObsidian_(self, sender):
        vault_path = self.config.get("vault_path")
        if not vault_path or not os.path.exists(vault_path):
            self.chooseVaultPath_(sender)
            vault_path = self.config.get("vault_path")
            if not vault_path:
                return

        success, msg = export_to_obsidian_keylog(vault_path)
        notify("Inkwell Obsidian Sync", msg)

    def chooseVaultPath_(self, sender):
        panel = NSOpenPanel.openPanel()
        panel.setCanChooseFiles_(False)
        panel.setCanChooseDirectories_(True)
        panel.setAllowsMultipleSelection_(False)
        panel.setMessage_("Select your Obsidian Vault root folder:")

        if panel.runModal() == NSModalResponseOK:
            url = panel.URLs()[0]
            vault_path = url.path()
            self.config["vault_path"] = vault_path
            save_config(self.config)
            self.update_menu()
            notify("Inkwell", f"Obsidian Vault set to: {vault_path}")

    def cleanDb_(self, sender):
        try:
            conn = sqlite3.connect(DB_PATH)
            cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM keystrokes")
            before = cursor.fetchone()[0]
            cursor.execute("DELETE FROM keystrokes WHERE timestamp < ?", (cutoff,))
            conn.commit()
            cursor.execute("SELECT COUNT(*) FROM keystrokes")
            after = cursor.fetchone()[0]
            cursor.execute("VACUUM")
            conn.commit()
            conn.close()
            deleted = before - after
            notify("Inkwell DB Cleaned", f"Removed {deleted} records (>30 days).")
        except Exception as e:
            notify("Inkwell Error", f"Clean failed: {e}")

    def revealDb_(self, sender):
        if os.path.exists(DB_PATH):
            NSWorkspace.sharedWorkspace().selectFile_inFileViewerRootedAtPath_(DB_PATH, os.path.dirname(DB_PATH))
        else:
            notify("Inkwell", "Database file not found yet.")

    def quitApp_(self, sender):
        NSApp().terminate_(self)

    def log_keystroke(self, app_name: str, key_char: str, key_code: int):
        if self.is_paused:
            return
        try:
            conn = sqlite3.connect(DB_PATH)
            conn.execute("PRAGMA journal_mode=WAL;")
            timestamp = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO keystrokes (timestamp, app_name, key_char, key_code) VALUES (?, ?, ?, ?)",
                (timestamp, app_name, key_char, key_code)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Error logging keystroke: {e}", file=sys.stderr)

    def get_key_char(self, event, key_code: int) -> str:
        flags = Quartz.CGEventGetFlags(event)
        has_cmd = bool(flags & Quartz.kCGEventFlagMaskCommand)
        has_opt = bool(flags & Quartz.kCGEventFlagMaskAlternate)
        has_ctrl = bool(flags & Quartz.kCGEventFlagMaskControl)
        has_shift = bool(flags & Quartz.kCGEventFlagMaskShift)

        special_keys = {
            51: "⌫",
            117: "⌦",
            36: "↵",
            48: "⇥",
            49: " ",
            123: "←",
            124: "→",
            125: "↓",
            126: "↑",
            53: "ESC",
        }

        is_special = key_code in special_keys
        if is_special:
            base = special_keys[key_code]
        else:
            actual_length, characters = Quartz.CGEventKeyboardGetUnicodeString(event, 100, None, None)
            base = characters if actual_length > 0 else ""

        prefix = ""
        if has_cmd or has_opt or has_ctrl:
            if has_cmd: prefix += "⌘"
            if has_opt: prefix += "⌥"
            if has_ctrl: prefix += "⌃"
            if has_shift: prefix += "⇧"

        if prefix:
            if is_special and base == " ":
                return f"[{prefix} ]"
            return f"[{prefix}{base.upper() if not is_special else base}]"
        else:
            if is_special:
                if base == " ":
                    return " "
                return f"[{base}]"
            else:
                if has_shift:
                    return base.upper()
                return base

    def keyboard_callback(self, proxy, event_type, event, refcon):
        if event_type == Quartz.kCGEventTapDisabledByTimeout:
            if self.tap:
                Quartz.CGEventTapEnable(self.tap, True)
            return event

        if event_type == Quartz.kCGEventKeyDown:
            try:
                key_code = Quartz.CGEventGetIntegerValueField(event, Quartz.kCGKeyboardEventKeycode)
                front_app = NSWorkspace.sharedWorkspace().frontmostApplication()
                app_name = front_app.localizedName() if front_app else "Unknown"

                key_char = self.get_key_char(event, key_code)
                if key_char:
                    self.log_keystroke(app_name, key_char, key_code)
            except Exception as e:
                print(f"Callback error: {e}", file=sys.stderr)

        return event

    def start_event_tap(self):
        # Run synchronously on the MAIN thread. The tap's run-loop source is
        # attached to the main run loop, which NSApplication.run() already
        # pumps — so the callback fires reliably (a separate background-thread
        # run loop proved unreliable once the app's main run loop is active).
        event_mask = (1 << Quartz.kCGEventKeyDown)

        def cb(proxy, evt_type, evt, refcon):
            return self.keyboard_callback(proxy, evt_type, evt, refcon)

        # Retry until the tap can be created. macOS adds this binary to the
        # Input Monitoring list only after the first failed attempt, and the
        # user may grant it while the app is already running — so we keep
        # trying instead of giving up on the first failure.
        while True:
            self.tap = Quartz.CGEventTapCreate(
                Quartz.kCGSessionEventTap,
                Quartz.kCGTailAppendEventTap,
                Quartz.kCGEventTapOptionListenOnly,
                event_mask,
                cb,
                None
            )
            if self.tap:
                break

            if not self.permission_prompted:
                print("Error: CGEventTapCreate failed. The binary running this process is not "
                      "authorized in System Settings → Privacy & Security → Input Monitoring.",
                      file=sys.stderr)
                print(f"Offending executable (must be added to Input Monitoring): {sys.executable}",
                      file=sys.stderr)
                self._request_input_monitoring_permission()
                self.permission_prompted = True

            print("Input Monitoring not granted yet — retrying in 5s...", file=sys.stderr)
            time.sleep(5)

        run_loop_source = Quartz.CFMachPortCreateRunLoopSource(None, self.tap, 0)
        Quartz.CFRunLoopAddSource(Quartz.CFRunLoopGetMain(), run_loop_source, Quartz.kCFRunLoopCommonModes)
        Quartz.CGEventTapEnable(self.tap, True)
        print("Inkwell event tap active.", file=sys.stderr)

    def _request_input_monitoring_permission(self):
        try:
            exe = sys.executable
            notify(
                "Inkwell needs Input Monitoring",
                "Open System Settings → Privacy & Security → Input Monitoring, enable the "
                "python3 binary, then it will start capturing automatically."
            )
            # Open the Input Monitoring privacy pane
            NSWorkspace.sharedWorkspace().openURL_(
                Foundation.NSURL.URLWithString_(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent"
                )
            )
            # Reveal the exact executable in Finder so it can be dragged in if missing
            parent = os.path.dirname(exe)
            NSWorkspace.sharedWorkspace().selectFile_inFileViewerRootedAtPath_(exe, parent)
        except Exception as e:
            print(f"Permission helper error: {e}", file=sys.stderr)

def main():
    app = NSApplication.sharedApplication()
    delegate = InkwellApp.alloc().init()
    app.setDelegate_(delegate)
    # Create the event tap on the main thread and attach it to the main run
    # loop. This must happen before app.run() so the tap is live immediately.
    delegate.start_event_tap()
    app.run()

if __name__ == "__main__":
    main()
