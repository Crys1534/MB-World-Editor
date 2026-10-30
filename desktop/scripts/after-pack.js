// Pone el ícono y los datos (nombre, versión) al .exe. Se hace con "resedit" (JavaScript puro),
// así funciona igual al fabricar el instalador en Windows o en Linux.
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
    if (context.electronPlatformName !== 'win32') return;
    const ResEdit = await import('resedit');
    const { NtExecutable, NtExecutableResource, Data, Resource } = ResEdit.default || ResEdit;
    const pkg = context.packager.appInfo;
    const exePath = path.join(context.appOutDir, pkg.productFilename + '.exe');
    const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
    const res = NtExecutableResource.from(exe);

    const iconFile = Data.IconFile.from(fs.readFileSync(path.join(__dirname, '..', 'resources', 'icon.ico')));
    const groups = Resource.IconGroupEntry.fromEntries(res.entries);
    const groupId = groups.length ? groups[0].id : 1;
    const lang = groups.length ? groups[0].lang : 1033;
    Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map(i => i.data));

    const vers = Resource.VersionInfo.fromEntries(res.entries);
    const v = (pkg.version || '1.0.0').split('.').map(n => parseInt(n, 10) || 0);
    const vi = vers.length ? vers[0] : Resource.VersionInfo.createEmpty();
    vi.setFileVersion(v[0], v[1], v[2], 0, 1033);
    vi.setProductVersion(v[0], v[1], v[2], 0, 1033);
    const langs = vi.getAllLanguagesForStringValues();
    const target = langs.length ? langs : [{ lang: 1033, codepage: 1200 }];
    for (const l of target) {
        vi.setStringValues(l, {
            FileDescription: pkg.productName,
            ProductName: pkg.productName,
            CompanyName: 'Crys1534',
            LegalCopyright: 'MB World Editor',
            OriginalFilename: pkg.productFilename + '.exe',
            InternalName: pkg.productName,
            FileVersion: pkg.version,
            ProductVersion: pkg.version
        });
    }
    vi.outputToResourceEntries(res.entries);
    res.outputResource(exe);
    fs.writeFileSync(exePath, Buffer.from(exe.generate()));
    console.log('  ícono y versión puestos en ' + path.basename(exePath));
};
