"""
לוח כוכבי התנהגות לילדים
דרישת התקנה: pip install customtkinter
הרצה:        python stars_app.py
"""

import json
import os
from tkinter import messagebox, simpledialog

import customtkinter as ctk

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "stars_data.json")

ctk.set_appearance_mode("light")
ctk.set_default_color_theme("blue")


class StarsApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("לוח כוכבי התנהגות ⭐")
        self.geometry("700x650")
        self.minsize(600, 500)

        self.kids = self._load_data()

        self._build_header()
        self._build_scroll_area()
        self._build_footer()
        self._refresh_list()

    # ---------- שמירה / טעינה ----------
    def _load_data(self):
        if not os.path.exists(DATA_FILE):
            return {}
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {name: int(stars) for name, stars in data.items()}
        except (json.JSONDecodeError, ValueError, OSError):
            return {}

    def _save_data(self):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.kids, f, ensure_ascii=False, indent=2)

    # ---------- בניית ממשק ----------
    def _build_header(self):
        header = ctk.CTkFrame(self, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(20, 10))

        title = ctk.CTkLabel(
            header,
            text="⭐  לוח הכוכבים שלנו  ⭐",
            font=ctk.CTkFont(size=30, weight="bold"),
        )
        title.pack(anchor="center")

    def _build_scroll_area(self):
        self.scroll = ctk.CTkScrollableFrame(self, corner_radius=15)
        self.scroll.pack(fill="both", expand=True, padx=20, pady=10)

    def _build_footer(self):
        footer = ctk.CTkFrame(self, fg_color="transparent")
        footer.pack(fill="x", padx=20, pady=(10, 20))

        add_btn = ctk.CTkButton(
            footer,
            text="➕ הוסף ילד",
            font=ctk.CTkFont(size=18, weight="bold"),
            height=55,
            corner_radius=12,
            fg_color="#2563eb",
            hover_color="#1d4ed8",
            command=self._add_child,
        )
        add_btn.pack(side="right", expand=True, fill="x", padx=(10, 0))

        reset_btn = ctk.CTkButton(
            footer,
            text="🔄 איפוס שבוע",
            font=ctk.CTkFont(size=18, weight="bold"),
            height=55,
            corner_radius=12,
            fg_color="#f59e0b",
            hover_color="#d97706",
            command=self._reset_week,
        )
        reset_btn.pack(side="right", expand=True, fill="x", padx=(0, 10))

    # ---------- שורת ילד ----------
    def _build_child_row(self, name: str, stars: int):
        row = ctk.CTkFrame(self.scroll, corner_radius=15, fg_color=("#f3f4f6", "#1f2937"))
        row.pack(fill="x", padx=10, pady=8, ipady=8)

        # כפתור מחיקה (קטן, צד שמאל)
        delete_btn = ctk.CTkButton(
            row,
            text="✕",
            width=36,
            height=36,
            corner_radius=18,
            font=ctk.CTkFont(size=14, weight="bold"),
            fg_color="transparent",
            text_color=("#6b7280", "#9ca3af"),
            hover_color=("#e5e7eb", "#374151"),
            command=lambda n=name: self._delete_child(n),
        )
        delete_btn.pack(side="left", padx=10)

        # כפתור מינוס
        minus_btn = ctk.CTkButton(
            row,
            text="−",
            width=70,
            height=70,
            corner_radius=35,
            font=ctk.CTkFont(size=32, weight="bold"),
            fg_color="#dc2626",
            hover_color="#b91c1c",
            command=lambda n=name: self._change_stars(n, -1),
        )
        minus_btn.pack(side="left", padx=10)

        # כפתור פלוס
        plus_btn = ctk.CTkButton(
            row,
            text="+",
            width=70,
            height=70,
            corner_radius=35,
            font=ctk.CTkFont(size=32, weight="bold"),
            fg_color="#16a34a",
            hover_color="#15803d",
            command=lambda n=name: self._change_stars(n, +1),
        )
        plus_btn.pack(side="right", padx=10)

        # ניקוד + שם (בצד ימין כי עברית)
        info = ctk.CTkFrame(row, fg_color="transparent")
        info.pack(side="right", fill="both", expand=True, padx=15)

        name_lbl = ctk.CTkLabel(
            info,
            text=name,
            font=ctk.CTkFont(size=24, weight="bold"),
            anchor="e",
        )
        name_lbl.pack(fill="x")

        stars_lbl = ctk.CTkLabel(
            info,
            text=f"⭐ {stars}",
            font=ctk.CTkFont(size=22),
            anchor="e",
            text_color="#f59e0b",
        )
        stars_lbl.pack(fill="x")

    def _refresh_list(self):
        for w in self.scroll.winfo_children():
            w.destroy()

        if not self.kids:
            empty = ctk.CTkLabel(
                self.scroll,
                text="אין עדיין ילדים ברשימה.\nלחצו על 'הוסף ילד' כדי להתחיל 🌟",
                font=ctk.CTkFont(size=18),
                text_color=("#6b7280", "#9ca3af"),
                justify="center",
            )
            empty.pack(pady=60)
            return

        for name, stars in sorted(self.kids.items(), key=lambda kv: (-kv[1], kv[0])):
            self._build_child_row(name, stars)

    # ---------- פעולות ----------
    def _add_child(self):
        name = simpledialog.askstring("הוספת ילד", "מה שם הילד/ה?", parent=self)
        if not name:
            return
        name = name.strip()
        if not name:
            return
        if name in self.kids:
            messagebox.showwarning("שם קיים", f"כבר יש ילד בשם '{name}'.", parent=self)
            return
        self.kids[name] = 0
        self._save_data()
        self._refresh_list()

    def _delete_child(self, name: str):
        if messagebox.askyesno("מחיקה", f"למחוק את {name} מהרשימה?", parent=self):
            self.kids.pop(name, None)
            self._save_data()
            self._refresh_list()

    def _change_stars(self, name: str, delta: int):
        if name not in self.kids:
            return
        self.kids[name] = max(0, self.kids[name] + delta)
        self._save_data()
        self._refresh_list()

    def _reset_week(self):
        if not self.kids:
            return
        if messagebox.askyesno(
            "איפוס שבוע",
            "לאפס את כל הכוכבים של כל הילדים ל-0?",
            parent=self,
        ):
            for name in self.kids:
                self.kids[name] = 0
            self._save_data()
            self._refresh_list()


if __name__ == "__main__":
    app = StarsApp()
    app.mainloop()
