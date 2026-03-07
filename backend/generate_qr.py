import qrcode
img = qrcode.make('upi://pay?pa=scammer@okaxis&pn=PM%20Cares%20Fund')
img.save('mock_scam_qr.png')

img2 = qrcode.make('upi://pay?pa=merchant@sbi&pn=SBI%20Customer')
img2.save('mock_safe_qr.png')
