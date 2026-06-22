from __future__ import annotations

from io import BytesIO

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

from .matrix_image import create_matrix_png


def set_east_asia_font(run, font_name: str = "Microsoft JhengHei") -> None:
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font_name)


def shade_cell(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shading = tc_pr.find(qn("w:shd"))
    if shading is None:
        shading = OxmlElement("w:shd")
        tc_pr.append(shading)
    shading.set(qn("w:fill"), fill)


def set_cell_text(cell, text: str, bold: bool = False) -> None:
    cell.text = ""
    paragraph = cell.paragraphs[0]
    run = paragraph.add_run(str(text))
    set_east_asia_font(run)
    run.bold = bold
    run.font.size = Pt(9)
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER


def add_table(document: Document, headers: list[str], rows: list[list[str]], widths: list[float] | None = None) -> None:
    table = document.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    for index, header in enumerate(headers):
        cell = table.rows[0].cells[index]
        set_cell_text(cell, header, bold=True)
        shade_cell(cell, "DDEBE4")
        if widths:
            cell.width = Inches(widths[index])
    for row in rows:
        cells = table.add_row().cells
        for index, value in enumerate(row):
            set_cell_text(cells[index], value)
            if widths:
                cells[index].width = Inches(widths[index])


def add_paragraph(document: Document, text: str, style: str | None = None):
    paragraph = document.add_paragraph(style=style)
    run = paragraph.add_run(text)
    set_east_asia_font(run)
    return paragraph


def add_heading(document: Document, text: str, level: int = 1):
    paragraph = document.add_heading(level=level)
    run = paragraph.add_run(text)
    set_east_asia_font(run)
    run.font.color.rgb = RGBColor(24, 83, 61)
    return paragraph


def score(value: float) -> str:
    return f"{value:.2f}"


def topic_rank(data: dict) -> list[dict]:
    return sorted(
        data["topics"],
        key=lambda item: (item["weighted_impact"] + item["weighted_financial"], item["impact"] + item["financial"]),
        reverse=True,
    )


def material_topics(data: dict) -> list[dict]:
    return [topic for topic in topic_rank(data) if topic["quadrant"] == "重大主題"]


def normalize_matrix_image(matrix_image: bytes | None, data: dict) -> BytesIO:
    if matrix_image and matrix_image.startswith(b"\x89PNG\r\n\x1a\n"):
        output = BytesIO(matrix_image)
        output.seek(0)
        return output
    return create_matrix_png(data)


def configure_document(document: Document) -> None:
    section = document.sections[0]
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)
    styles = document.styles
    styles["Normal"].font.name = "Microsoft JhengHei"
    styles["Normal"]._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft JhengHei")
    styles["Normal"].font.size = Pt(10.5)
    for name in ["Heading 1", "Heading 2", "Heading 3"]:
        styles[name].font.name = "Microsoft JhengHei"
        styles[name]._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft JhengHei")


def add_cover(document: Document, data: dict) -> None:
    title = document.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("大學永續報告書\n雙重重大性評估報告")
    set_east_asia_font(run)
    run.bold = True
    run.font.size = Pt(24)
    run.font.color.rgb = RGBColor(24, 83, 61)

    subtitle = document.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(f"{data['campaign'].year} 年度｜{data['campaign'].title}")
    set_east_asia_font(run)
    run.font.size = Pt(13)
    run.font.color.rgb = RGBColor(90, 110, 100)

    document.add_paragraph()
    add_table(
        document,
        ["項目", "內容"],
        [
            ["有效回收數", f"{data['response_count']} 份"],
            ["涵蓋利害關係人類別", f"{data['stakeholder_count']} 類"],
            ["衝擊重大性門檻", f"{data['campaign'].impact_threshold:.1f}"],
            ["財務重大性門檻", f"{data['campaign'].financial_threshold:.1f}"],
            ["文件狀態", data["ai_analysis"]["disclaimer"]],
        ],
        widths=[1.8, 4.8],
    )
    document.add_page_break()


def add_stakeholder_section(document: Document, data: dict) -> None:
    add_heading(document, "2.3 利害關係人溝通", 1)
    add_paragraph(
        document,
        (
            f"本次雙重重大性評估共回收 {data['response_count']} 份有效問卷，"
            f"涵蓋 {data['stakeholder_count']} 類利害關係人。問卷結果同時保留未加權平均、"
            "利害關係人權重與分群統計，以支持永續報告書揭露與後續佐證。"
        ),
    )
    rows = [[item["name"], str(item["count"]), f"{item['weight']:.2f}"] for item in data["stakeholders"]]
    add_table(document, ["利害關係人類別", "回收數", "權重"], rows, widths=[3.0, 1.2, 1.2])


def add_process_section(document: Document, data: dict) -> None:
    add_heading(document, "2.4 重大主題鑑別流程", 1)
    add_paragraph(document, data["ai_analysis"]["gri_3_1"])
    add_table(
        document,
        ["步驟", "說明", "佐證資料"],
        [
            ["1. 議題庫建立", "依 E/S/G、GRI、SDGs、責任單位與管理方針建立議題清單。", "議題庫版本、啟用狀態"],
            ["2. 利害關係人參與", "透過登入填答或匿名邀請碼蒐集評分與開放意見。", "問卷活動、邀請碼、回收數"],
            ["3. 雙重重大性計算", "分別計算衝擊重大性與財務重大性，並保留未加權與加權結果。", "原始填答、分群平均、權重設定"],
            ["4. 重大性判定", "依年度門檻分為重大主題、揭露主題、風險主題與觀察主題。", "重大性矩陣、門檻設定"],
        ],
        widths=[1.4, 3.6, 2.0],
    )


def add_result_section(document: Document, data: dict, matrix_image: BytesIO) -> None:
    add_heading(document, "2.5 雙重重大性評估結果", 1)
    add_paragraph(document, data["ai_analysis"]["report_paragraph_zh"])
    document.add_picture(matrix_image, width=Inches(6.4))
    document.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption = document.add_paragraph("圖 2.5-1 雙重重大性矩陣")
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption.runs[0].font.size = Pt(9)

    rows = [
        [
            f"{topic['code']} {topic['name']}",
            topic["category"],
            score(topic["impact"]),
            score(topic["financial"]),
            score(topic["weighted_impact"]),
            score(topic["weighted_financial"]),
            str(topic["response_count"]),
            topic["quadrant"],
        ]
        for topic in topic_rank(data)
    ]
    add_table(
        document,
        ["議題", "E/S/G", "衝擊", "財務", "加權衝擊", "加權財務", "樣本", "判定"],
        rows,
        widths=[2.0, 0.7, 0.7, 0.7, 0.8, 0.8, 0.6, 1.0],
    )

    add_heading(document, "AI 分析摘要", 2)
    for field in ["zh_summary", "en_summary", "material_topic_ranking", "stakeholder_difference_analysis", "management_recommendations"]:
        add_paragraph(document, data["ai_analysis"][field])


def add_management_section(document: Document, data: dict) -> None:
    add_heading(document, "2.6 重大主題管理方針", 1)
    add_paragraph(document, data["ai_analysis"]["management_recommendations"])
    selected = material_topics(data) or topic_rank(data)[:5]
    rows = [
        [
            f"{topic['code']} {topic['name']}",
            topic["quadrant"],
            "請責任單位確認管理方針、KPI、年度目標與追蹤機制。",
        ]
        for topic in selected
    ]
    add_table(document, ["重大議題", "判定", "管理建議"], rows, widths=[2.3, 1.2, 3.5])


def add_gri_sections(document: Document, data: dict) -> None:
    add_heading(document, "GRI 3-1 Process to determine material topics", 1)
    add_paragraph(document, data["ai_analysis"]["gri_3_1"])
    add_heading(document, "GRI 3-2 List of material topics", 1)
    add_paragraph(document, data["ai_analysis"]["gri_3_2"])
    add_heading(document, "GRI 3-3 Management of material topics", 1)
    add_paragraph(document, data["ai_analysis"]["gri_3_3"])


def add_appendix(document: Document, data: dict) -> None:
    add_heading(document, "附錄：問卷方法、樣本數、權重、評分尺度、門檻設定", 1)
    add_table(
        document,
        ["項目", "設定"],
        [
            ["評分尺度", "1 = 極低、2 = 低、3 = 中、4 = 高、5 = 極高"],
            ["衝擊重大性", "衝擊規模、衝擊範圍、可補救性、發生可能性之彙整分數"],
            ["財務重大性", "財務影響程度、營運韌性影響、發生可能性之彙整分數"],
            ["衝擊門檻", f"{data['campaign'].impact_threshold:.1f}"],
            ["財務門檻", f"{data['campaign'].financial_threshold:.1f}"],
            ["樣本數", f"{data['response_count']} 份有效問卷"],
            ["AI 使用聲明", data["ai_analysis"]["disclaimer"]],
        ],
        widths=[1.8, 4.8],
    )


def create_materiality_report(data: dict, matrix_image: bytes | None = None) -> BytesIO:
    document = Document()
    configure_document(document)
    core = document.core_properties
    core.author = "University Materiality Platform"
    core.last_modified_by = "University Materiality Platform"
    core.title = "Double Materiality Assessment Report"
    core.subject = "Stakeholder engagement and material topics"
    core.comments = data["ai_analysis"]["disclaimer"]

    matrix_stream = normalize_matrix_image(matrix_image, data)
    add_cover(document, data)
    add_stakeholder_section(document, data)
    add_process_section(document, data)
    add_result_section(document, data, matrix_stream)
    add_management_section(document, data)
    add_gri_sections(document, data)
    add_appendix(document, data)

    for section in document.sections:
        footer = section.footer.paragraphs[0]
        footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = footer.add_run(data["ai_analysis"]["disclaimer"])
        set_east_asia_font(run)
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(110, 120, 115)

    output = BytesIO()
    document.save(output)
    output.seek(0)
    return output
