'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');

function loadI18n() {
  const document = {
    readyState: 'loading',
    addEventListener() {},
    querySelectorAll() { return []; },
    createTreeWalker() { return { nextNode() { return null; } }; },
    documentElement: { setAttribute() {} },
    dispatchEvent() {}
  };
  const context = {
    document,
    navigator: { language: 'en' },
    localStorage: { getItem() { return 'en'; }, setItem() {} },
    CustomEvent: function CustomEvent() {},
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    MutationObserver: function MutationObserver() { this.observe = function() {}; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'assets/js/i18n.js' });
  return context.I18N;
}

test('Round 136: all supported locales have complete runtime copy for dynamic UI states', () => {
  const i18n = loadI18n();
  const keys = [
    'legalTitle','amountParen','tradeRecords','loadingText','loginToGetDepositAddress','depositChannelMaintenance','networkTryAgain','loginToViewDeposits',
    'noDepositRecords','loginToViewWithdrawals','noWithdrawalRecords','recordsLoadFailed','submitting','confirmWithdrawal',
    'confirmSubscription','earnProduct','loginToViewEarn','noEarnHoldings','assetDepositNow','showAllAssets','hideSmallAssets',
    'loginToSendMessage','noChatYet','kycVerified','kycReviewing','kycNotComplete','kycApproved','unlimited','riskBasedLimit',
    'enabled','basicLimit','availableAfterVerification','improvedAfterVerification','fundPasswordSet','fundPasswordMissing',
    'currentLoginPassword','newPasswordMin','confirmNewPassword','fundPassword6','enterAgain','secretCopied','enter2fa',
    'enter2faToDisable','marketPrice','noData','confirmBuy','confirmSell','noOrderHistory','loginToViewRecords','loadingRecords',
    'noAssetsWithBalance','showAssets','switchNetworkSuffix','enable2faTitle','twofaInstruction','qrLoading','copySecret',
    'confirmEnable','changeLoginPassword','submitSuccess','twofaEnabled','passwordChanged','fundPasswordCreated','twofaDisabled',
    'confirmChange','setFundPasswordTitle','fundPasswordPurpose','confirmSet','disable2faTitle','disable2faWarning','confirmDisable',
    'supportAgentAvatar','supportUserAvatar','loginToContactSupport','goLogin','accountHolder','bankName','accountNumber',
    'routingNumber','swiftBic','bankAddress','addressNetworkError','addressOperationFailed','contactSupportForChanges','themeLight','themeDark'
  ];
  for (const lang of i18n.getSupported()) {
    for (const key of keys) assert.equal(typeof i18n.DICT[lang][key], 'string', `${lang}.${key} must be translated`);
    assert.equal(i18n.DICT[lang].themeLight.length > 0, true, `${lang}.themeLight must not be empty`);
    assert.equal(i18n.DICT[lang].themeDark.length > 0, true, `${lang}.themeDark must not be empty`);
  }
  for (const key of ['legalTitle','amountParen','tradeRecords']) assert.notEqual(i18n.DICT['zh-CN'][key], key, `Chinese locale must not expose internal key ${key}`);
});

test('Round 136: English locale preserves unmapped Chinese source text (no error placeholder)', () => {
  assert.match(source, /currentLang === 'en' && \/\[\\u3400-\\u9fff\]\/.test\(source\)/);
  assert.doesNotMatch(source, /This content is not available in English\./);
  assert.match(source, /attributes:true, attributeFilter:\['placeholder','title','aria-label','alt'\]/);
  assert.match(source, /record\.type === 'attributes' && record\.target\) apply\(record\.target\)/);
});

test('Round 136: theme status follows the selected locale after a language change', () => {
  const settings = fs.readFileSync(path.join(root, 'pages/settings.html'), 'utf8');
  assert.match(settings, /I18N\.t\(theme==='light'\?'themeLight':'themeDark'\)/);
  assert.match(settings, /document\.addEventListener\('langChange',applyTheme\)/);
});
