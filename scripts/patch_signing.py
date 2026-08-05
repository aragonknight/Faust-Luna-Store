"""
Dipanggil dari .github/workflows/build-apk.yml setelah `cap add android` /
`cap sync android` (yang meregenerasi folder android/ dari nol tiap build,
karena folder itu di-gitignore). Tanpa patch ini, build debug APK bakal
ngandelin lokasi keystore default (~/.android/debug.keystore) yang gak
selalu konsisten dipakai gradle antar-run CI, jadi signature APK bisa beda
tiap build -> HP nolak update ("APK bertabrakan / conflicts"), harus uninstall
manual dulu tiap kali mau pasang versi baru.

Script ini nyisipin signingConfig eksplisit ke android/app/build.gradle yang
nunjuk LANGSUNG ke debug.keystore yang di-commit di root repo, jadi setiap
build APK-nya PASTI pakai sertifikat yang sama persis -> bisa di-update
langsung tanpa uninstall.
"""

path = "android/app/build.gradle"
content = open(path).read()

signing_block = '''
    signingConfigs {
        debug {
            storeFile file("${rootProject.projectDir}/../debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }
'''
content = content.replace("android {", "android {" + signing_block, 1)

debug_buildtype_block = '''        debug {
            signingConfig signingConfigs.debug
        }
'''
content = content.replace("buildTypes {", "buildTypes {\n" + debug_buildtype_block, 1)

open(path, "w").write(content)
print("Signing config berhasil dipasang ke app/build.gradle")
