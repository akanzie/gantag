import pandas as pd
import re

def format_line_with_stars_and_escape(line):
    stripped = line.strip()
    if not stripped:
        return ""

    # Tự động bọc endpoint trong văn bản
    line = re.sub(r'(/[a-zA-Z0-9/_.-]+)', r'`\1`', line)

    # Nếu là dòng tiêu đề kết quả (VD: 4. 小計 `/sales/subtotal`)
    if re.search(r'\d+\..*`/', line):
        return f"* #### {line.strip()}"

    # Logic xử lý dấu đầu dòng đặc biệt
    stripped_after_sub = line.strip()
    if stripped_after_sub.startswith('+'):
        return f"* * \\{stripped_after_sub}"
    
    if stripped_after_sub.startswith('-'):
        return f"* \\{stripped_after_sub}"
    
    if stripped_after_sub.startswith('.'):
        return f"* * * \\{stripped_after_sub}"

    if stripped_after_sub.startswith('・'):
        return f"* * {stripped_after_sub}"

    if stripped_after_sub.startswith('→'):
        return f"* * {stripped_after_sub}"

    if line.startswith(' ') or line.startswith('\t'):
        return f"* * {stripped_after_sub}"

    return f"* {stripped_after_sub}"

def format_scenario_to_table(text):
    """Xử lý cột N: Tách Step | 手順 | エンドポイント"""
    if not text or pd.isna(text) or str(text).strip() == "": 
        return "| - | 特になし | - |"
    
    header = "| Step | 手順 | エンドポイント |\n * | :-: | :--- | :--- |"
    rows = []
    lines = str(text).split('\n')
    
    for line in lines:
        line = line.strip()
        if not line: continue
        
        match = re.match(r'^(\d+)\.?\s*(.*?)\s+(/\S+)', line)
        
        if match:
            step, desc, endpoint = match.groups()
            rows.append(f"| {step} | {desc.strip()} | `{endpoint.strip()}` |")
        else:
            formatted_line = re.sub(r'(/[a-zA-Z0-9/_.-]+)', r'`\1`', line)
            rows.append(f"| - | {formatted_line} | - |")
            
    return header + "\n * " + "\n * ".join(rows)

def format_general_content(text, is_precondition=False):
    """
    Format tổng quát. 
    Nếu is_precondition=True và rỗng thì trả về 特になし.
    """
    stripped_text = str(text).strip() if pd.notna(text) else ""
    
    # Chỉ xử lý '特になし' cho cột Precondition (Cột W)
    if is_precondition:
        if not stripped_text or stripped_text == "" or stripped_text == "'特になし":
            return "* 特になし"
    
    # Nếu rỗng và không phải cột W thì trả về chuỗi rỗng
    if not stripped_text:
        return ""
    
    lines = str(text).split('\n')
    formatted = []
    
    for line in lines:
        result = format_line_with_stars_and_escape(line)
        if result:
            formatted.append(result)
            
    return "\n * ".join(formatted)

def export_jsdoc_final_v10(excel_path, output_file='final_jsdoc_v10.txt'):
    try:
        # Đọc C(2), L(11), M(12), N(13), W(22), X(23), Z(25)
        target_cols = [2, 11, 12, 13, 22, 23, 25]
        df = pd.read_excel(excel_path, usecols=target_cols, header=None)
        df.columns = ['C', 'L', 'M', 'N', 'W', 'X', 'Z']

        with open(output_file, 'w', encoding='utf-8') as f:
            for index, row in df.iterrows():
                if index == 0: continue 

                scenario_no = str(row['C']).strip() if pd.notna(row['C']) else "N/A"

                jsdoc = (
                    f"/**\n"
                    f" * シナリオ番号：{scenario_no}\n"
                    f" * @function {row['L']}\n"
                    f" * @memberof 返品\n"
                    f" * @description\n"
                    f" * ### テスト観点\n"
                    f" * {format_general_content(row['M'])}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### テスト方法/シナリオ\n"
                    f" * {format_scenario_to_table(row['N'])}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### 前提条件\n"
                    f" * {format_general_content(row['W'], is_precondition=True)}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### テストデータ\n"
                    f" * {format_general_content(row['X'])}\n"
                    f" * \n"
                    f" * ---\n"
                    f" * ### 期待結果\n"
                    f" * {format_general_content(row['Z'])}\n"
                    f" */\n\n"
                )
                f.write(jsdoc)
        print(f"Hoàn tất! Chỉ cột 前提条件 rỗng mới điền '特になし': {output_file}")
    except Exception as e:
        print(f"Lỗi: {e}")

# Chạy code
export_jsdoc_final_v10('Scenario.xlsx')
