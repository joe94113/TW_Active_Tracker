Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $PSScriptRoot "..\public\line"
$outputPath = Join-Path $outputDir "rich-menu-main.png"

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$width = 2500
$height = 1686
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$backgroundRect = [System.Drawing.Rectangle]::new(0, 0, $width, $height)
$backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $backgroundRect,
  [System.Drawing.Color]::FromArgb(8, 18, 32),
  [System.Drawing.Color]::FromArgb(16, 36, 62),
  90
)
$graphics.FillRectangle($backgroundBrush, $backgroundRect)

$overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(24, 59, 130, 212))
$graphics.FillEllipse($overlayBrush, -260, -210, 880, 880)
$graphics.FillEllipse($overlayBrush, 1710, 980, 940, 940)
$overlayBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 18, 120, 200))
$graphics.FillEllipse($overlayBrush2, 1320, 1180, 680, 680)

$titleFont = New-Object System.Drawing.Font("Microsoft JhengHei", 84, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font("Microsoft JhengHei", 28, [System.Drawing.FontStyle]::Regular)
$tileTitleFont = New-Object System.Drawing.Font("Microsoft JhengHei", 72, [System.Drawing.FontStyle]::Bold)
$tileDescFont = New-Object System.Drawing.Font("Microsoft JhengHei", 26, [System.Drawing.FontStyle]::Regular)
$tileTagFont = New-Object System.Drawing.Font("Microsoft JhengHei", 23, [System.Drawing.FontStyle]::Bold)
$whiteBrush = [System.Drawing.Brushes]::White
$softBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(205, 221, 238))
$hintBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(98, 117, 134))
$cardBodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(46, 58, 72))

$tiles = @(
  @{ X = 110;  Y = 120; Width = 710; Height = 620; Accent = [System.Drawing.Color]::FromArgb(34, 197, 94);  Title = "今日盤勢"; Desc = "加權 / 廣度 / 盤後"; Tag = "盤勢" },
  @{ X = 895;  Y = 120; Width = 710; Height = 620; Accent = [System.Drawing.Color]::FromArgb(14, 165, 233); Title = "選股雷達"; Desc = "穩健型 / 積極型"; Tag = "選股" },
  @{ X = 1680; Y = 120; Width = 710; Height = 620; Accent = [System.Drawing.Color]::FromArgb(249, 115, 22); Title = "起漲卡位"; Desc = "剛轉強 / 待突破"; Tag = "起漲" },
  @{ X = 110;  Y = 900; Width = 710; Height = 620; Accent = [System.Drawing.Color]::FromArgb(168, 85, 247); Title = "題材熱度"; Desc = "資金輪動 / 主線"; Tag = "題材" },
  @{ X = 895;  Y = 900; Width = 710; Height = 620; Accent = [System.Drawing.Color]::FromArgb(245, 158, 11); Title = "ETF 研究"; Desc = "主動式 / 高股息"; Tag = "ETF" },
  @{ X = 1680; Y = 900; Width = 710; Height = 620; Accent = [System.Drawing.Color]::FromArgb(236, 72, 153); Title = "股票教學"; Desc = "技術面 / 風控"; Tag = "教學" }
)

foreach ($tile in $tiles) {
  $tileX = [int]$tile['X']
  $tileY = [int]$tile['Y']
  $tileWidth = [int]$tile['Width']
  $tileHeight = [int]$tile['Height']
  $tileTag = [string]$tile['Tag']
  $tileTitle = [string]$tile['Title']
  $tileDesc = [string]$tile['Desc']
  $tileAccent = $tile['Accent']
  $rect = [System.Drawing.Rectangle]::new($tileX, $tileY, $tileWidth, $tileHeight)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radius = 46
  $diameter = $radius * 2

  $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  $fillBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(245, 249, 253, 255),
    [System.Drawing.Color]::FromArgb(231, 240, 248, 255),
    90
  )
  $graphics.FillPath($fillBrush, $path)

  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(92, 255, 255, 255), 2)
  $graphics.DrawPath($borderPen, $path)

  $accentBrush = New-Object System.Drawing.SolidBrush($tileAccent)
  $chipRect = [System.Drawing.Rectangle]::new(($tileX + 48), ($tileY + 48), 148, 52)
  $chipPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $chipRadius = 18
  $chipDiameter = $chipRadius * 2
  $chipPath.AddArc($chipRect.X, $chipRect.Y, $chipDiameter, $chipDiameter, 180, 90)
  $chipPath.AddArc($chipRect.Right - $chipDiameter, $chipRect.Y, $chipDiameter, $chipDiameter, 270, 90)
  $chipPath.AddArc($chipRect.Right - $chipDiameter, $chipRect.Bottom - $chipDiameter, $chipDiameter, $chipDiameter, 0, 90)
  $chipPath.AddArc($chipRect.X, $chipRect.Bottom - $chipDiameter, $chipDiameter, $chipDiameter, 90, 90)
  $chipPath.CloseFigure()
  $chipFill = New-Object System.Drawing.SolidBrush($tileAccent)
  $graphics.FillPath($chipFill, $chipPath)
  $graphics.DrawString($tileTag, $tileTagFont, $whiteBrush, $tileX + 79, $tileY + 61)

  $graphics.DrawString($tileTitle, $tileTitleFont, [System.Drawing.Brushes]::Black, $tileX + 52, $tileY + 228)
  $graphics.DrawString($tileDesc, $tileDescFont, $hintBrush, $tileX + 58, $tileY + 376)

  $fillBrush.Dispose()
  $borderPen.Dispose()
  $accentBrush.Dispose()
  $chipFill.Dispose()
  $chipPath.Dispose()
  $path.Dispose()
}

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$titleFont.Dispose()
$subtitleFont.Dispose()
$tileTitleFont.Dispose()
$tileDescFont.Dispose()
$tileTagFont.Dispose()
$softBrush.Dispose()
$hintBrush.Dispose()
$cardBodyBrush.Dispose()
$overlayBrush.Dispose()
$overlayBrush2.Dispose()
$backgroundBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Generated LINE rich menu image: $outputPath"

