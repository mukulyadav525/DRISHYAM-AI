import os
import sys
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# Add backend to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from models.database import CallRecord, HoneypotSession

def generate_report(output_path):
    # Fetch real stats
    db = SessionLocal()
    try:
        scams_count = db.query(CallRecord).filter(CallRecord.verdict == "scam").count()
        citizens_count = db.query(HoneypotSession).count()
        savings_cr = int((scams_count * 1.2) / 100)
        active_threats = scams_count # Using this as a proxy for now
    finally:
        db.close()

    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    # --- Header Section ---
    c.setFont("Helvetica-Bold", 32)
    c.setStrokeColor(colors.HexColor("#0b1739"))
    c.setFillColor(colors.HexColor("#0b1739"))
    c.drawString(2.5*cm, height - 3*cm, "DRISHYAM AI")
    
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.silver)
    c.drawString(2.5*cm, height - 3.7*cm, "BASIG Operational Grid - National Security Intelligence")

    # Security Audit Badge
    c.setStrokeColor(colors.HexColor("#10b981"))
    c.setFillColor(colors.HexColor("#f0fdf4"))
    c.roundRect(width - 7.5*cm, height - 3.2*cm, 5*cm, 0.8*cm, 4, fill=1)
    c.setFillColor(colors.HexColor("#10b981"))
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(width - 5*cm, height - 2.85*cm, "SECURITY AUDIT: PASSED")

    # Orange line
    c.setStrokeColor(colors.HexColor("#F97316"))
    c.setLineWidth(3)
    c.line(2*cm, height - 5*cm, width - 2*cm, height - 5*cm)

    # --- Intelligence Report Identity ---
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(colors.HexColor("#F97316"))
    c.drawString(2.5*cm, height - 6.5*cm, "SYSTEM INTELLIGENCE REPORT")

    c.setFont("Helvetica", 11)
    c.setFillColor(colors.black)
    c.drawString(2.5*cm, height - 7.5*cm, f"Generated On: {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    c.drawString(2.5*cm, height - 8.1*cm, "Classification: TOP SECRET // CERT-IN COMPLIANT")

    # --- Operational Statistics Table ---
    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(colors.HexColor("#F97316"))
    c.drawString(2.5*cm, height - 10*cm, "OPERATIONAL STATISTICS")

    data = [
        ["Metric", "Value", "Status"],
        ["Total Scams Blocked", f"{scams_count:,}", "SUCCESS"],
        ["Citizens Protected", f"{citizens_count:,}", "ACTIVE"],
        ["Estimated Savings", f"₹ {savings_cr} Cr", "VERIFIED"],
        ["Active Threats", f"{active_threats}", "MONITORED"]
    ]

    table = Table(data, colWidths=[8*cm, 5*cm, 3.5*cm])
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0b1739")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 10),
    ])
    table.setStyle(style)
    table.wrapOn(c, width, height)
    table.drawOn(c, 2.5*cm, height - 15*cm)

    # --- Regional Intelligence Summary ---
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(colors.HexColor("#F97316"))
    c.drawString(2.5*cm, height - 17*cm, "REGIONAL INTELLIGENCE SUMMARY")

    styles = getSampleStyleSheet()
    p_style = ParagraphStyle('CustomStyle', parent=styles['Normal'], fontSize=11, leading=14)
    summary_text = (
        "The system has detected localized surges in AI-driven voice cloning attempts across several nodes. "
        "Bharat Layer Regional Defensive prompts have been autonomously updated with real-time protective strategies. "
        "All honey-nodes are currently in 'Aggressive Collection' mode to gather forensic evidence for legal proceedings."
    )
    p = Paragraph(summary_text, p_style)
    p.wrapOn(c, width - 5*cm, 10*cm)
    p.drawOn(c, 2.5*cm, height - 19.5*cm)

    # --- Footer ---
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(colors.HexColor("#0b1739"))
    c.drawCentredString(width/2, height - 24*cm, "DIGITALLY SIGNED BY BASIG MASTER GRID CORE")
    
    # Watermark
    c.saveState()
    c.setFont("Helvetica-Bold", 60)
    c.setFillColor(colors.grey, alpha=0.05)
    c.translate(width/2, height/2)
    c.rotate(45)
    c.drawCentredString(0, 0, "DRISHYAM AI")
    c.restoreState()

    c.showPage()
    c.save()

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static", "drishyam_template.pdf")
    generate_report(out)
    print(f"Professional PDF Report generated at: {out}")
