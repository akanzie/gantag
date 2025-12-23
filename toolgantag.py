import pandas as pd
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import re
import os

class TaggingTool:
    def __init__(self, root):
        self.root = root
        self.root.title("Tool Gán Tag Scenario - Hỗ trợ Search & Auto-Select")
        self.root.geometry("1150x850")

        # 1. Đọc dữ liệu Master Tag
        try:
            self.df_tags = pd.read_excel('tags_master.xlsx').fillna('')
        except Exception as e:
            messagebox.showerror("Lỗi", f"Không tìm thấy tags_master.xlsx\n{e}")
            self.df_tags = pd.DataFrame()

        # 2. Đọc dữ liệu Dịch thuật (Dictionary)
        self.translation_dict = {}
        try:
            df_dict = pd.read_excel('dictionary.xlsx').fillna('')
            for _, row in df_dict.iterrows():
                jp_key = str(row.iloc[0]).strip()
                self.translation_dict[jp_key] = {
                    'vi': str(row.iloc[1]).strip(),
                    'en': str(row.iloc[2]).strip()
                }
        except:
            messagebox.showwarning("Chú ý", "Không tìm thấy file dictionary.xlsx")

        self.tc_list = self.load_testcases_from_txt('testcase_list.txt')
        self.results = [] 
        self.search_timer = None # Để quản lý thời gian đợi gõ dấu tiếng Việt
        self.create_widgets()

    def load_testcases_from_txt(self, filename):
        if not os.path.exists(filename): return ["File không tồn tại"]
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
            tcs = re.findall(r'TC_[a-zA-Z0-9_-]+', content)
            return sorted(list(set(tcs)))

    def create_widgets(self):
        # --- BƯỚC 1: CHỌN TC ---
        frame_top = ttk.LabelFrame(self.root, text="BƯỚC 1: CHỌN MÃ TEST CASE")
        frame_top.pack(fill="x", padx=10, pady=5)
        self.cb_tc = ttk.Combobox(frame_top, values=self.tc_list, width=40)
        self.cb_tc.pack(side="left", padx=10, pady=10)

        # --- TÌM KIẾM NHANH (SEARCH) ---
        frame_search = ttk.LabelFrame(self.root, text="TÌM KIẾM TAG NHANH (Gõ Tiếng Việt hoặc Tiếng Nhật)")
        frame_search.pack(fill="x", padx=10, pady=5)
        
        self.ent_search = ttk.Entry(frame_search, width=50)
        self.ent_search.pack(side="left", padx=10, pady=10)
        self.ent_search.bind("<KeyRelease>", self.on_search)

        self.cb_search_results = ttk.Combobox(frame_search, width=60, state="readonly")
        self.cb_search_results.pack(side="left", padx=10, pady=10)
        self.cb_search_results.bind("<<ComboboxSelected>>", self.on_select_search_result)
        ttk.Label(frame_search, text="(Gợi ý kết quả)").pack(side="left")

        # --- BƯỚC 2: CHỌN TAG PHÂN CẤP ---
        frame_mid = ttk.LabelFrame(self.root, text="BƯỚC 2: CHỌN TAG THEO CẤP (Nghiệp vụ)")
        frame_mid.pack(fill="x", padx=10, pady=5)
        self.levels = []
        for i in range(6):
            f_col = ttk.Frame(frame_mid)
            f_col.grid(row=0, column=i, padx=5, pady=5)
            ttk.Label(f_col, text=f"Cấp {i+1}").pack()
            cb = ttk.Combobox(f_col, state="readonly", width=20)
            cb.pack()
            cb.bind("<<ComboboxSelected>>", lambda e, idx=i: self.update_next_levels(idx))
            self.levels.append(cb)

        if not self.df_tags.empty:
            self.levels[0]['values'] = sorted(self.df_tags.iloc[:, 0].unique().tolist())

        # --- GIẢI THÍCH ---
        frame_info = ttk.LabelFrame(self.root, text="GIẢI THÍCH CHI TIẾT")
        frame_info.pack(fill="x", padx=10, pady=5)
        self.txt_vi = tk.Text(frame_info, height=2, font=("Arial", 10), fg="blue")
        self.txt_vi.pack(fill="x", padx=5, pady=2)
        self.txt_en = tk.Text(frame_info, height=2, font=("Arial", 10), fg="green")
        self.txt_en.pack(fill="x", padx=5, pady=2)

        # --- DANH SÁCH ĐÃ GÁN ---
        btn_frame = ttk.Frame(self.root)
        btn_frame.pack(pady=5)
        ttk.Button(btn_frame, text="THÊM TAG VÀO TC", command=self.add_tag).pack(side="left", padx=5)
        ttk.Button(btn_frame, text="XÓA DÒNG", command=self.delete_tag).pack(side="left", padx=5)
        
        self.listbox_tags = tk.Listbox(self.root, height=12, font=("Courier New", 10))
        self.listbox_tags.pack(fill="both", expand=True, padx=10, pady=5)
        
        ttk.Button(self.root, text="XUẤT FILE MAPPING (.CSV)", command=self.export_to_csv).pack(pady=10)

    def on_search(self, event):
        """Khắc phục lỗi gõ tiếng Việt bằng cơ chế Debounce"""
        if self.search_timer:
            self.root.after_cancel(self.search_timer)
        self.search_timer = self.root.after(400, self.perform_search)

    def perform_search(self):
        query = self.ent_search.get().lower().strip()
        if len(query) < 2: 
            self.cb_search_results['values'] = []
            return

        match_results = []
        for jp, trans in self.translation_dict.items():
            if query in jp.lower() or query in trans['vi'].lower() or query in trans['en'].lower():
                match_results.append(f"{jp} ({trans['vi']})")
        
        self.cb_search_results['values'] = match_results
        if match_results:
            self.cb_search_results.event_generate('<Button-1>')

    def on_select_search_result(self, event):
        """Khi chọn từ search, tự động nhảy Dropdown khớp với Master Tag"""
        selected_full = self.cb_search_results.get()
        if not selected_full: return
        selected_jp = selected_full.split(" (")[0]
        
        # 1. Hiển thị dịch
        trans = self.translation_dict.get(selected_jp, {})
        self.txt_vi.delete("1.0", tk.END); self.txt_vi.insert("1.0", trans.get('vi', ''))
        self.txt_en.delete("1.0", tk.END); self.txt_en.insert("1.0", trans.get('en', ''))
        
        # 2. Tìm và nhảy Dropdown
        mask = self.df_tags.apply(lambda row: row.astype(str).str.contains(re.escape(selected_jp)).any(), axis=1)
        match_rows = self.df_tags[mask]

        if not match_rows.empty:
            row_data = match_rows.iloc[0]
            for cb in self.levels: cb.set('')

            for i in range(len(self.levels)):
                val = str(row_data.iloc[i])
                if val and val != 'nan' and val.strip() != '':
                    # Cập nhật list values cho cấp hiện tại để không bị lỗi 'out of list'
                    if i == 0:
                        self.levels[i]['values'] = sorted(self.df_tags.iloc[:, 0].unique().tolist())
                    else:
                        temp_df = self.df_tags
                        for j in range(i):
                            temp_df = temp_df[temp_df.iloc[:, j] == self.levels[j].get()]
                        self.levels[i]['values'] = sorted([str(v) for v in temp_df.iloc[:, i].unique().tolist() if v])
                    
                    self.levels[i].set(val)
                    if val == selected_jp: break

    def update_next_levels(self, current_idx):
        selected_val = self.levels[current_idx].get()
        trans = self.translation_dict.get(selected_val, {'vi': 'Chưa có bản dịch', 'en': 'N/A'})
        self.txt_vi.delete("1.0", tk.END); self.txt_vi.insert("1.0", trans['vi'])
        self.txt_en.delete("1.0", tk.END); self.txt_en.insert("1.0", trans['en'])

        for i in range(current_idx + 1, len(self.levels)):
            self.levels[i].set(''); self.levels[i]['values'] = []

        filtered_df = self.df_tags
        for i in range(current_idx + 1):
            val = self.levels[i].get()
            if val: filtered_df = filtered_df[filtered_df.iloc[:, i] == val]

        if current_idx + 1 < len(self.levels):
            next_vals = sorted([str(v) for v in filtered_df.iloc[:, current_idx + 1].unique().tolist() if v and str(v).strip() != ''])
            self.levels[current_idx + 1]['values'] = next_vals

    def add_tag(self):
        tc = self.cb_tc.get()
        tags = [cb.get() for cb in self.levels if cb.get()]
        if not tc or not tags:
            messagebox.showwarning("Chú ý", "Vui lòng chọn mã TC và ít nhất 1 Tag")
            return
        tag_path = " | ".join(tags)
        self.results.append({"TC": tc, "Tags": tag_path})
        self.listbox_tags.insert(tk.END, f"{tc.ljust(15)} : {tag_path}")

    def delete_tag(self):
        selected = self.listbox_tags.curselection()
        if selected:
            idx = selected[0]
            self.listbox_tags.delete(idx); self.results.pop(idx)

    def export_to_csv(self):
        if not self.results: return
        path = filedialog.asksaveasfilename(defaultextension=".csv", filetypes=[("CSV files", "*.csv")])
        if path:
            pd.DataFrame(self.results).to_csv(path, index=False, encoding='utf-8-sig')
            messagebox.showinfo("Xong", "Lưu thành công!")

if __name__ == "__main__":
    root = tk.Tk()
    app = TaggingTool(root)
    root.mainloop()
