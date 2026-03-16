const assert = require('assert');
const { shouldPreloadSprites } = require('../js/sprite-loader.js');

assert.equal(
  shouldPreloadSprites('http:'),
  true,
  'http 协议下应正常预加载素材',
);

assert.equal(
  shouldPreloadSprites('https:'),
  true,
  'https 协议下应正常预加载素材',
);

assert.equal(
  shouldPreloadSprites('file:'),
  false,
  'file 协议下应跳过素材预加载，避免开始按钮卡死',
);

console.log('sprite-loader test passed');
