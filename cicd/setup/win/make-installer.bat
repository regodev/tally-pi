for /f "tokens=*" %%a in ('node ..\..\version.js') do set ver=%%a
iscc /Dversion=%ver% "tally-pi.iss"