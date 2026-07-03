/**
 * FDA 采集运行脚本
 * 用法: node scripts/collect_fda.js
 */

require('dotenv').config();

const FDACollector = require('../src/crawlers/fda_collector');

async function main() {
  const collector = new FDACollector({
    apiKey: process.env.OPENFDA_API_KEY || '',
    outputDir: require('path').join(__dirname, '..', 'data', 'fda')
  });

  const result = await collector.run();

  console.log(`\n✅ FDA collection complete!`);
  console.log(`   Output: ${result.outputDir}`);
  console.log(`   Total unique items: ${result.total}`);
}

main().catch(error => {
  console.error('FDA collection failed:', error);
  process.exit(1);
});
