import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from datetime import datetime
import io

class PDFReportGenerator:
    """
    Generates a professional forensic PDF report for media authenticity.
    """
    
    @staticmethod
    def generate_trust_report(data: dict) -> bytes:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []

        # 1. Header
        header = Paragraph(f"<b>Sentinel 1930 - Media Forensic Audit Report</b>", styles['Title'])
        elements.append(header)
        elements.append(Spacer(1, 12))

        # 2. Summary Section
        elements.append(Paragraph(f"<b>Audit Timestamp:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC", styles['Normal']))
        elements.append(Paragraph(f"<b>Filename:</b> {data.get('filename', 'N/A')}", styles['Normal']))
        elements.append(Spacer(1, 12))

        # 3. Verdict Indicator
        verdict = data.get('verdict', 'UNKNOWN').upper()
        verdict_color = colors.green if verdict == "REAL" else colors.red if verdict == "FAKE" else colors.orange
        
        verdict_style = styles['Heading2']
        elements.append(Paragraph(f"<b>AUTHENTICITY VERDICT: <font color='{verdict_color.hexval()}'>{verdict}</font></b>", verdict_style))
        elements.append(Spacer(1, 12))

        # 4. Metrics Table
        metrics_data = [
            ["Metric", "Value"],
            ["Confidence Score", f"{data.get('confidence', 0) * 100:.1f}%"],
            ["Risk Level", data.get('risk_level', 'UNKNOWN')],
            ["Analysis Engine", "Deepfake-Defense-V1-Hybrid"]
        ]
        t = Table(metrics_data, colWidths=[200, 200])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ]))
        elements.append(t)
        elements.append(Spacer(1, 20))

        # 5. Anomalies
        elements.append(Paragraph("<b>Detected Anomalies:</b>", styles['Heading3']))
        anomalies = data.get('anomalies', [])
        if not anomalies:
            elements.append(Paragraph("• No significant anomalies detected.", styles['Normal']))
        else:
            for anomaly in anomalies:
                elements.append(Paragraph(f"• {anomaly}", styles['Normal']))
        
        elements.append(Spacer(1, 20))

        # 6. Technical Details
        elements.append(Paragraph("<b>Technical Forensic Breakdown:</b>", styles['Heading3']))
        details = data.get('analysis_details', {})
        for k, v in details.items():
            elements.append(Paragraph(f"<b>{k.replace('_', ' ').capitalize()}:</b> {v}", styles['Normal']))

        # Build PDF
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes

pdf_report_generator = PDFReportGenerator()
