Add-Type -AssemblyName System.Drawing
$source = "C:\Users\Owner\.gemini\antigravity\brain\41302ca4-6a51-4466-822f-8aa7ec815044\media__1780060154608.png"
$destDir = "c:\Users\Owner\Desktop\darkpen-main\mobile-app\assets\images"

$img = [System.Drawing.Image]::FromFile($source)
$img.Save("$destDir\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save("$destDir\splash-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save("$destDir\favicon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save("$destDir\darkpen-logo-black.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save("$destDir\darkpen-logo-blue.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save("$destDir\darkpen-logo-white.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Save("$destDir\android-icon-foreground.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Write-Output "All logo images updated successfully!"
