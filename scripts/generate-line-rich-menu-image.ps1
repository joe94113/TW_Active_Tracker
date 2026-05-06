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

$backgroundRect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $backgroundRect,
  [System.Drawing.Color]::FromArgb(10, 22, 36),
  [System.Drawing.Color]::FromArgb(22, 49, 78),
  90
)
$graphics.FillRectangle($backgroundBrush, $backgroundRect)

$overlayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(28, 103, 201, 255))
$graphics.FillEllipse($overlayBrush, -220, -160, 820, 820)
$graphics.FillEllipse($overlayBrush, 1750, 980, 860, 860)

$titleFont = New-Object System.Drawing.Font("Microsoft JhengHei", 72, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font("Microsoft JhengHei", 30, [System.Drawing.FontStyle]::Regular)
$tileTitleFont = New-Object System.Drawing.Font("Microsoft JhengHei", 48, [System.Drawing.FontStyle]::Bold)
$tileDescFont = New-Object System.Drawing.Font("Microsoft JhengHei", 24, [System.Drawing.FontStyle]::Regular)
$whiteBrush = [System.Drawing.Brushes]::White
$softBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 227, 243))
$hintBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 112, 132))

$graphics.DrawString("台股主動通", $titleFont, $whiteBrush, 110, 72)
$graphics.DrawString("點一下直接查盤勢、選股、起漲、題材、ETF 與股票教學", $subtitleFont, $softBrush, 114, 166)

$tiles = @(
  @{ X = 110;  Y = 280; Width = 710; Height = 520; Accent = [System.Drawing.Color]::FromArgb(34, 197, 94);  Title = "今日盤勢"; Desc = "先看加權、廣度與明日重點"; Tag = "盤勢" },
  @{ X = 895;  Y = 280; Width = 710; Height = 520; Accent = [System.Drawing.Color]::FromArgb(14, 165, 233); Title = "選股雷達"; Desc = "看穩健型、積極型與名單"; Tag = "選股" },
  @{ X = 1680; Y = 280; Width = 710; Height = 520; Accent = [System.Drawing.Color]::FromArgb(249, 115, 22); Title = "起漲卡位"; Desc = "看剛轉強、待突破與卡位點"; Tag = "起漲" },
  @{ X = 110;  Y = 910; Width = 710; Height = 520; Accent = [System.Drawing.Color]::FromArgb(168, 85, 247); Title = "題材熱度"; Desc = "看資金輪動、龍頭股與補漲股"; Tag = "題材" },
  @{ X = 895;  Y = 910; Width = 710; Height = 520; Accent = [System.Drawing.Color]::FromArgb(245, 158, 11); Title = "ETF 研究"; Desc = "看主動式、高息 ETF 與重疊持股"; Tag = "ETF" },
  @{ X = 1680; Y = 910; Width = 710; Height = 520; Accent = [System.Drawing.Color]::FromArgb(236, 72, 153); Title = "股票教學"; Desc = "用白話看懂技術面、風控與新手流程"; Tag = "教學" }
)

foreach ($tile in $tiles) {
  $rect = New-Object System.Drawing.Rectangle($tile.X, $tile.Y, $tile.Width, $tile.Height)
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
    [System.Drawing.Color]::FromArgb(236, 248, 255, 255),
    [System.Drawing.Color]::FromArgb(222, 242, 252, 255),
    90
  )
  $graphics.FillPath($fillBrush, $path)

  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), 2)
  $graphics.DrawPath($borderPen, $path)

  $accentBrush = New-Object System.Drawing.SolidBrush($tile.Accent)
  $graphics.FillEllipse($accentBrush, $tile.X + 42, $tile.Y + 42, 92, 92)
  $graphics.DrawString($tile.Tag, $tileDescFont, $whiteBrush, $tile.X + 56, $tile.Y + 70)

  $graphics.DrawString($tile.Title, $tileTitleFont, [System.Drawing.Brushes]::Black, $tile.X + 44, $tile.Y + 162)
  $graphics.DrawString($tile.Desc, $tileDescFont, $hintBrush, $tile.X + 48, $tile.Y + 248)
  $graphics.DrawString("點一下直接送出關鍵字並回覆 Flex 訊息", $tileDescFont, $softBrush, $tile.X + 48, $tile.Y + 420)

  $fillBrush.Dispose()
  $borderPen.Dispose()
  $accentBrush.Dispose()
  $path.Dispose()
}

$graphics.DrawString("也可以直接輸入 2330、2455 這類股票代號，快速查個股頁。", $subtitleFont, $softBrush, 118, 1550)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$titleFont.Dispose()
$subtitleFont.Dispose()
$tileTitleFont.Dispose()
$tileDescFont.Dispose()
$softBrush.Dispose()
$hintBrush.Dispose()
$overlayBrush.Dispose()
$backgroundBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "Generated LINE rich menu image: $outputPath"

