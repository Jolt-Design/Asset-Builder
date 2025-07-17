[asset-builder](https://github.com/Jolt-Design/Asset-Builder/)
=============

Fork of [asset-builder](http://use-asset-builder.austinpray.com/) without the Bower requirement.

Assembles and orchestrates your dependencies so you can run them through your asset pipeline. Feed it a [manifest file](help/spec.md) and it will give you globs.

![NPM](https://nodei.co/npm/@joltdesign/asset-builder.png?downloads=true)

## Install

```bash
npm install @joltdesign/asset-builder --save-dev
```

## Usage

```javascript
var manifest = require('asset-builder')('./assets/manifest.json');
```

## Help

- [Examples, troubleshooting tips](help/)
- [Manifest File Specification](help/spec.md)
- [View this module's API documentation](http://use-asset-builder.austinpray.com/api/)
- [Walk through the annotated source code](http://use-asset-builder.austinpray.com/docco/)
