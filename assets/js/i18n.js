/* ============================================================
   BTCBOX v3.3 — 多语言自适应模块 (i18n)
   自动检测浏览器语言，支持：zh-CN / zh-TW / en / ja / ko / vi
   用法：元素加 data-i18n="key"，页面加载自动翻译；
         动态文本调用 I18N.t('key')
   ============================================================ */
(function(global){
  'use strict';

  var DICT = {
    'zh-CN': {
      home:'首页', markets:'行情', trade:'交易', seconds:'秒合约', assets:'资产', me:'我的',
      login:'登录', register:'注册', logout:'退出',
      deposit:'充值', withdraw:'提现', earn:'理财', orders:'订单', kyc:'KYC认证', support:'客服', settings:'设置',
      buy:'买入', sell:'卖出', amount:'数量', price:'价格', available:'可用', total:'合计', confirm:'确认', cancel:'取消',
      search:'搜索', hot:'热门', gainers:'涨幅榜', losers:'跌幅榜', fav:'自选',
      coin:'币种', lastPrice:'最新价', change24h:'24h涨跌', trend:'走势',
      topCoins:'主流行情', hotPairs:'热门交易对', quickTrade:'快速交易', moreServices:'更多服务',
      allMarkets:'全部行情', marketTabs:'行情',
      safeDays:'1,825+ 天', safeOp:'安全运营', feeRate:'交易费率', coldStorage:'冷钱包储备',
      openOrders:'当前委托', positions:'持仓', history:'历史成交',
      noOrders:'暂无委托，下单后在此显示', noPosition:'暂无持仓', noHistory:'暂无历史成交',
      loginToView:'登录后查看资产', loginToTrade:'登录后可交易、充值、提现', goLogin:'去登录',
      registerNow:'立即注册', forgotPwd:'忘记密码？', rememberMe:'记住我',
      email:'邮箱', password:'密码', emailPh:'请输入邮箱地址', pwdPh:'请输入密码（至少6位）',
      googleLogin:'使用 Google 账号继续', noAccount:'还没有账号？',
      agreeTerms:'登录即表示同意服务条款和隐私政策',
      platformTitle:'专业的数字资产交易平台', ssl:'SSL 加密传输', support24:'7×24 小时客服', cold98:'98% 资产冷存储',
      riskWarning:'数字资产交易涉及风险，请谨慎投资',
      terms:'服务条款', privacy:'隐私政策', risk:'风险揭示书',
      totalAsset:'总资产估值 (USDT)', todayPnl:'今日盈亏', hide:'隐藏',
      limit:'限价', market:'市价', max:'最大',
      confirmBuy:'确认买入', confirmSell:'确认卖出',
      orderSubmitted:'下单成功', orderFailed:'下单失败', networkError:'网络错误，请重试',
      pleaseLogin:'请先登录后操作',
      myAssets:'我的资产', smallAssets:'隐藏小额资产', noAsset:'暂无资产，立即充值',
      withdrawReview:'审核中', orderOpen:'未成交', orderFilled:'已成交', orderCancel:'已取消',
      language:'语言', about:'关于', security:'安全中心', notification:'通知',
      chart:'图表', depth:'深度',
      high24:'24h最高', low24:'24h最低', vol24:'24h额',
      invite:'邀请返佣', help:'帮助中心',
      secondsTitle:'秒合约', earnTitle:'理财',
      kycTitle:'身份认证', kycLevel:'认证等级',
      supportTitle:'在线客服', settingsTitle:'设置',
      legalTitle:'法律条款',
      depositAddr:'充值地址', withdrawAddr:'提币地址',
      copy:'复制', paste:'粘贴', submit:'提交',
      success:'成功', failed:'失败', pending:'处理中',
      loading:'加载中...', noData:'暂无数据',
      brandSub:'Digital Asset Exchange'
    },
    'zh-TW': {
      home:'首頁', markets:'行情', trade:'交易', seconds:'秒合約', assets:'資產', me:'我的',
      login:'登入', register:'註冊', logout:'登出',
      deposit:'充值', withdraw:'提現', earn:'理財', orders:'訂單', kyc:'KYC認證', support:'客服', settings:'設定',
      buy:'買入', sell:'賣出', amount:'數量', price:'價格', available:'可用', total:'合計', confirm:'確認', cancel:'取消',
      search:'搜尋', hot:'熱門', gainers:'漲幅榜', losers:'跌幅榜', fav:'自選',
      coin:'幣種', lastPrice:'最新價', change24h:'24h漲跌', trend:'走勢',
      topCoins:'主流行情', hotPairs:'熱門交易對', quickTrade:'快速交易', moreServices:'更多服務',
      allMarkets:'全部行情',
      safeDays:'1,825+ 天', safeOp:'安全營運', feeRate:'交易費率', coldStorage:'冷錢包儲備',
      openOrders:'當前委託', positions:'持倉', history:'歷史成交',
      noOrders:'暫無委託，下單後在此顯示', noPosition:'暫無持倉', noHistory:'暫無歷史成交',
      loginToView:'登入後查看資產', loginToTrade:'登入後可交易、充值、提現', goLogin:'去登入',
      registerNow:'立即註冊', forgotPwd:'忘記密碼？', rememberMe:'記住我',
      email:'郵箱', password:'密碼', emailPh:'請輸入郵箱地址', pwdPh:'請輸入密碼（至少6位）',
      googleLogin:'使用 Google 帳號繼續', noAccount:'還沒有帳號？',
      agreeTerms:'登入即表示同意服務條款和隱私政策',
      platformTitle:'專業的數位資產交易平台', ssl:'SSL 加密傳輸', support24:'7×24 小時客服', cold98:'98% 資產冷儲存',
      riskWarning:'數位資產交易涉及風險，請謹慎投資',
      terms:'服務條款', privacy:'隱私政策', risk:'風險揭示書',
      totalAsset:'總資產估值 (USDT)', todayPnl:'今日盈虧', hide:'隱藏',
      limit:'限價', market:'市價', max:'最大',
      confirmBuy:'確認買入', confirmSell:'確認賣出',
      orderSubmitted:'下單成功', orderFailed:'下單失敗', networkError:'網路錯誤，請重試',
      pleaseLogin:'請先登入後操作',
      myAssets:'我的資產', smallAssets:'隱藏小額資產', noAsset:'暫無資產，立即充值',
      withdrawReview:'審核中', orderOpen:'未成交', orderFilled:'已成交', orderCancel:'已取消',
      language:'語言', about:'關於', security:'安全中心', notification:'通知',
      chart:'圖表', depth:'深度',
      high24:'24h最高', low24:'24h最低', vol24:'24h額',
      invite:'邀請返佣', help:'幫助中心',
      secondsTitle:'秒合約', earnTitle:'理財',
      kycTitle:'身份認證', kycLevel:'認證等級',
      supportTitle:'線上客服', settingsTitle:'設定',
      legalTitle:'法律條款',
      depositAddr:'充值地址', withdrawAddr:'提幣地址',
      copy:'複製', paste:'貼上', submit:'提交',
      success:'成功', failed:'失敗', pending:'處理中',
      loading:'載入中...', noData:'暫無資料',
      brandSub:'Digital Asset Exchange'
    },
    'en': {
      home:'Home', markets:'Markets', trade:'Trade', seconds:'Options', assets:'Assets', me:'Me',
      login:'Log In', register:'Sign Up', logout:'Log Out',
      deposit:'Deposit', withdraw:'Withdraw', earn:'Earn', orders:'Orders', kyc:'KYC', support:'Support', settings:'Settings',
      buy:'Buy', sell:'Sell', amount:'Amount', price:'Price', available:'Available', total:'Total', confirm:'Confirm', cancel:'Cancel',
      search:'Search', hot:'Hot', gainers:'Gainers', losers:'Losers', fav:'Favorites',
      coin:'Coin', lastPrice:'Last Price', change24h:'24h Change', trend:'Trend',
      topCoins:'Top Markets', hotPairs:'Hot Pairs', quickTrade:'Quick Trade', moreServices:'More Services',
      allMarkets:'All Markets',
      safeDays:'1,825+ Days', safeOp:'Safe Operation', feeRate:'Trading Fee', coldStorage:'Cold Storage',
      openOrders:'Open Orders', positions:'Positions', history:'History',
      noOrders:'No open orders. Place an order to see it here.', noPosition:'No positions', noHistory:'No history',
      loginToView:'Log in to view assets', loginToTrade:'Log in to trade, deposit & withdraw', goLogin:'Log In →',
      registerNow:'Sign Up Now', forgotPwd:'Forgot password?', rememberMe:'Remember me',
      email:'Email', password:'Password', emailPh:'Enter your email', pwdPh:'Password (min 6 chars)',
      googleLogin:'Continue with Google', noAccount:"Don't have an account?",
      agreeTerms:'By logging in, you agree to the Terms & Privacy Policy',
      platformTitle:'Professional Digital Asset Exchange', ssl:'SSL Encrypted', support24:'24/7 Support', cold98:'98% Cold Storage',
      riskWarning:'Digital asset trading involves risk. Invest wisely.',
      terms:'Terms', privacy:'Privacy', risk:'Risk Disclosure',
      totalAsset:'Total Assets (USDT)', todayPnl:"Today's P&L", hide:'Hide',
      limit:'Limit', market:'Market', max:'Max',
      confirmBuy:'Confirm Buy', confirmSell:'Confirm Sell',
      orderSubmitted:'Order placed', orderFailed:'Order failed', networkError:'Network error, retry',
      pleaseLogin:'Please log in first',
      myAssets:'My Assets', smallAssets:'Hide small assets', noAsset:'No assets. Deposit now',
      withdrawReview:'Reviewing', orderOpen:'Open', orderFilled:'Filled', orderCancel:'Canceled',
      language:'Language', about:'About', security:'Security', notification:'Notifications',
      chart:'Chart', depth:'Depth',
      high24:'24h High', low24:'24h Low', vol24:'24h Vol',
      invite:'Invite & Earn', help:'Help Center',
      secondsTitle:'Options', earnTitle:'Earn',
      kycTitle:'Identity Verification', kycLevel:'Level',
      supportTitle:'Support', settingsTitle:'Settings',
      legalTitle:'Legal',
      depositAddr:'Deposit Address', withdrawAddr:'Withdraw Address',
      copy:'Copy', paste:'Paste', submit:'Submit',
      success:'Success', failed:'Failed', pending:'Processing',
      loading:'Loading...', noData:'No data',
      brandSub:'Digital Asset Exchange'
    },
    'ja': {
      home:'ホーム', markets:'マーケット', trade:'取引', seconds:'オプション', assets:'資産', me:'マイページ',
      login:'ログイン', register:'登録', logout:'ログアウト',
      deposit:'入金', withdraw:'出金', earn:'イールド', orders:'注文', kyc:'KYC認証', support:'サポート', settings:'設定',
      buy:'買い', sell:'売り', amount:'数量', price:'価格', available:'利用可能', total:'合計', confirm:'確認', cancel:'キャンセル',
      search:'検索', hot:'人気', gainers:'上昇率', losers:'下落率', fav:'お気に入り',
      coin:'コイン', lastPrice:'最新価格', change24h:'24h変動', trend:'トレンド',
      topCoins:'主要市場', hotPairs:'人気ペア', quickTrade:'クイック取引', moreServices:'その他のサービス',
      allMarkets:'すべての市場',
      safeDays:'1,825日以上', safeOp:'安全運営', feeRate:'取引手数料', coldStorage:'コールドウォレット',
      openOrders:'未決注文', positions:'ポジション', history:'履歴',
      noOrders:'注文がありません', noPosition:'ポジションなし', noHistory:'履歴なし',
      loginToView:'ログインして資産を表示', loginToTrade:'ログインで取引・入出金可能', goLogin:'ログイン →',
      registerNow:'新規登録', forgotPwd:'パスワードをお忘れですか？', rememberMe:'ログイン状態を保持',
      email:'メールアドレス', password:'パスワード', emailPh:'メールアドレスを入力', pwdPh:'パスワード（6文字以上）',
      googleLogin:'Googleで続行', noAccount:'アカウントをお持ちでない方',
      agreeTerms:'ログインにより利用規約とプライバシーポリシーに同意します',
      platformTitle:'プロフェッショナル暗号資産取引所', ssl:'SSL暗号化', support24:'24時間年中無休サポート', cold98:'98% コールドウォレット',
      riskWarning:'暗号資産取引にはリスクがあります。慎重に投資してください。',
      terms:'利用規約', privacy:'プライバシー', risk:'リスク告知',
      totalAsset:'総資産 (USDT)', todayPnl:'本日の損益', hide:'非表示',
      limit:'指値', market:'成行', max:'最大',
      confirmBuy:'購入を確認', confirmSell:'売却を確認',
      orderSubmitted:'注文が送信されました', orderFailed:'注文に失敗しました', networkError:'ネットワークエラー、再試行してください',
      pleaseLogin:'先にログインしてください',
      myAssets:'資産一覧', smallAssets:'少額資産を非表示', noAsset:'資産がありません。入金してください',
      withdrawReview:'審査中', orderOpen:'未約定', orderFilled:'約定', orderCancel:'キャンセル',
      language:'言語', about:'について', security:'セキュリティ', notification:'通知',
      chart:'チャート', depth:'板',
      high24:'24h高値', low24:'24h安値', vol24:'24h出来高',
      invite:'招待キャンペーン', help:'ヘルプセンター',
      secondsTitle:'オプション', earnTitle:'イールド',
      kycTitle:'本人確認', kycLevel:'レベル',
      supportTitle:'サポート', settingsTitle:'設定',
      legalTitle:'法的事項',
      depositAddr:'入金アドレス', withdrawAddr:'出金アドレス',
      copy:'コピー', paste:'貼り付け', submit:'送信',
      success:'成功', failed:'失敗', pending:'処理中',
      loading:'読み込み中...', noData:'データなし',
      brandSub:'Digital Asset Exchange'
    },
    'ko': {
      home:'홈', markets:'시세', trade:'거래', seconds:'옵션', assets:'자산', me:'마이',
      login:'로그인', register:'회원가입', logout:'로그아웃',
      deposit:'입금', withdraw:'출금', earn:'이자', orders:'주문', kyc:'KYC인증', support:'고객센터', settings:'설정',
      buy:'매수', sell:'매도', amount:'수량', price:'가격', available:'가능', total:'합계', confirm:'확인', cancel:'취소',
      search:'검색', hot:'인기', gainers:'상승률', losers:'하락률', fav:'관심',
      coin:'코인', lastPrice:'현재가', change24h:'24h변동', trend:'추세',
      topCoins:'주요 시세', hotPairs:'인기 거래쌍', quickTrade:'빠른 거래', moreServices:'더보기',
      allMarkets:'전체 시세',
      safeDays:'1,825일+', safeOp:'안전 운영', feeRate:'수수료', coldStorage:'콜드월렛',
      openOrders:'미체결', positions:'포지션', history:'거래내역',
      noOrders:'주문 내역이 없습니다', noPosition:'포지션 없음', noHistory:'거래 내역 없음',
      loginToView:'로그인 후 자산 조회', loginToTrade:'로그인 후 거래/입출금 가능', goLogin:'로그인 →',
      registerNow:'회원가입', forgotPwd:'비밀번호 찾기', rememberMe:'로그인 유지',
      email:'이메일', password:'비밀번호', emailPh:'이메일 입력', pwdPh:'비밀번호 (6자 이상)',
      googleLogin:'Google로 계속', noAccount:'계정이 없으신가요?',
      agreeTerms:'로그인 시 이용약관 및 개인정보처리방침에 동의합니다',
      platformTitle:'프로페셔널 디지털 자산 거래소', ssl:'SSL 암호화', support24:'24/7 고객센터', cold98:'98% 콜드월렛',
      riskWarning:'디지털 자산 거래는 위험이 있습니다. 신중히 투자하세요.',
      terms:'이용약관', privacy:'개인정보', risk:'위험고지',
      totalAsset:'총 자산 (USDT)', todayPnl:'오늘 손익', hide:'숨기기',
      limit:'지정가', market:'시장가', max:'최대',
      confirmBuy:'매수 확인', confirmSell:'매도 확인',
      orderSubmitted:'주문 완료', orderFailed:'주문 실패', networkError:'네트워크 오류, 다시 시도',
      pleaseLogin:'먼저 로그인해 주세요',
      myAssets:'내 자산', smallAssets:'소액 자산 숨기기', noAsset:'자산 없음. 입금하기',
      withdrawReview:'심사중', orderOpen:'미체결', orderFilled:'체결', orderCancel:'취소',
      language:'언어', about:'정보', security:'보안', notification:'알림',
      chart:'차트', depth:'호가',
      high24:'24h고가', low24:'24h저가', vol24:'24h거래량',
      invite:'초대보상', help:'도움말',
      secondsTitle:'옵션', earnTitle:'이자',
      kycTitle:'본인인증', kycLevel:'등급',
      supportTitle:'고객센터', settingsTitle:'설정',
      legalTitle:'법적고지',
      depositAddr:'입금 주소', withdrawAddr:'출금 주소',
      copy:'복사', paste:'붙여넣기', submit:'제출',
      success:'성공', failed:'실패', pending:'처리중',
      loading:'로딩중...', noData:'데이터 없음',
      brandSub:'Digital Asset Exchange'
    },
    'vi': {
      home:'Trang chủ', markets:'Thị trường', trade:'Giao dịch', seconds:'Quán quyền', assets:'Tài sản', me:'Cá nhân',
      login:'Đăng nhập', register:'Đăng ký', logout:'Đăng xuất',
      deposit:'Nạp tiền', withdraw:'Rút tiền', earn:'Kiếm lãi', orders:'Đơn hàng', kyc:'Xác minh KYC', support:'Hỗ trợ', settings:'Cài đặt',
      buy:'Mua', sell:'Bán', amount:'Số lượng', price:'Giá', available:'Có sẵn', total:'Tổng', confirm:'Xác nhận', cancel:'Hủy',
      search:'Tìm kiếm', hot:'Nổi bật', gainers:'Tăng nhiều', losers:'Giảm nhiều', fav:'Yêu thích',
      coin:'Coin', lastPrice:'Giá mới nhất', change24h:'24h Thay đổi', trend:'Xu hướng',
      topCoins:'Thị trường chính', hotPairs:'Cặp giao dịch hot', quickTrade:'Giao dịch nhanh', moreServices:'Dịch vụ khác',
      allMarkets:'Tất cả thị trường',
      safeDays:'1,825+ Ngày', safeOp:'Vận hành an toàn', feeRate:'Phí giao dịch', coldStorage:'Ví lạnh',
      openOrders:'Đơn đang chờ', positions:'Vị thế', history:'Lịch sử',
      noOrders:'Chưa có đơn hàng', noPosition:'Chưa có vị thế', noHistory:'Chưa có lịch sử',
      loginToView:'Đăng nhập để xem tài sản', loginToTrade:'Đăng nhập để giao dịch/nạp/rút', goLogin:'Đăng nhập →',
      registerNow:'Đăng ký ngay', forgotPwd:'Quên mật khẩu?', rememberMe:'Ghi nhớ đăng nhập',
      email:'Email', password:'Mật khẩu', emailPh:'Nhập email', pwdPh:'Mật khẩu (tối thiểu 6 ký tự)',
      googleLogin:'Tiếp tục với Google', noAccount:'Chưa có tài khoản?',
      agreeTerms:'Đăng nhập đồng nghĩa với việc đồng ý Điều khoản & Chính sách bảo mật',
      platformTitle:'Sàn giao dịch tài sản số chuyên nghiệp', ssl:'Mã hóa SSL', support24:'Hỗ trợ 24/7', cold98:'98% Ví lạnh',
      riskWarning:'Giao dịch tài sản số có rủi ro. Hãy đầu tư thận trọng.',
      terms:'Điều khoản', privacy:'Bảo mật', risk:'Công bố rủi ro',
      totalAsset:'Tổng tài sản (USDT)', todayPnl:'Lãi lỗ hôm nay', hide:'Ẩn',
      limit:'Giá giới hạn', market:'Giá thị trường', max:'Tối đa',
      confirmBuy:'Xác nhận mua', confirmSell:'Xác nhận bán',
      orderSubmitted:'Đặt lệnh thành công', orderFailed:'Đặt lệnh thất bại', networkError:'Lỗi mạng, thử lại',
      pleaseLogin:'Vui lòng đăng nhập trước',
      myAssets:'Tài sản của tôi', smallAssets:'Ẩn tài sản nhỏ', noAsset:'Chưa có tài sản, nạp ngay',
      withdrawReview:'Đang duyệt', orderOpen:'Chờ khớp', orderFilled:'Đã khớp', orderCancel:'Đã hủy',
      language:'Ngôn ngữ', about:'Giới thiệu', security:'Bảo mật', notification:'Thông báo',
      chart:'Biểu đồ', depth:'Độ sâu',
      high24:'24h Cao', low24:'24h Thấp', vol24:'24h Khối lượng',
      invite:'Mời nhận thưởng', help:'Trợ giúp',
      secondsTitle:'Quán quyền', earnTitle:'Kiếm lãi',
      kycTitle:'Xác minh danh tính', kycLevel:'Cấp độ',
      supportTitle:'Hỗ trợ', settingsTitle:'Cài đặt',
      legalTitle:'Pháp lý',
      depositAddr:'Địa chỉ nạp', withdrawAddr:'Địa chỉ rút',
      copy:'Sao chép', paste:'Dán', submit:'Gửi',
      success:'Thành công', failed:'Thất bại', pending:'Đang xử lý',
      loading:'Đang tải...', noData:'Không có dữ liệu',
      brandSub:'Digital Asset Exchange'
    }
  };

  // ===== 补丁：补充 login.html 等页面缺失的 key（v3.3.1）=====
  var PATCH = {
    'zh-CN': {confirmPassword:'确认密码', confirmPwdPh:'请再次输入密码', registerAndLogin:'注册并登录', orDivider:'或', haveAccount:'已有账号？', goLogin:'去登录', submiting:'提交中...', fillAll:'请填写完整信息', pwdMismatch:'两次输入的密码不一致', regSuccess:'注册成功，已登录', loginSuccess:'登录成功', please6code:'请输入6位验证码', twofaTitle:'双重验证', twofaBody:'您的账号已开启双重验证，请输入 Google Authenticator 中的 6 位验证码', confirmLogin:'确认登录', frozenTitle:'账号已被冻结', frozenAppeal:'如对冻结有异议，请通过邮箱 support@btcbox.com 申诉', gotIt:'我知道了', opFailed:'操作失败，请重试', googleSuccess:'Google 账号登录成功', invalidEmail:'请输入有效的邮箱地址', googleFail:'Google 登录失败，请重试', resetPwdTitle:'重置密码', resetPwdBody:'为保障账户安全，密码重置需通过在线客服人工核验身份后办理。请联系在线客服协助重置。', contactSupport:'联系在线客服', copyright:'数字资产交易涉及风险，请谨慎投资', agreePrefix:'即表示同意'},
    'zh-TW': {confirmPassword:'確認密碼', confirmPwdPh:'請再次輸入密碼', registerAndLogin:'註冊並登入', orDivider:'或', haveAccount:'已有帳號？', goLogin:'去登入', submiting:'提交中...', fillAll:'請填寫完整資訊', pwdMismatch:'兩次輸入的密碼不一致', regSuccess:'註冊成功，已登入', loginSuccess:'登入成功', please6code:'請輸入6位驗證碼', twofaTitle:'雙重驗證', twofaBody:'您的帳號已開啟雙重驗證，請輸入 Google Authenticator 中的 6 位驗證碼', confirmLogin:'確認登入', frozenTitle:'帳號已被凍結', frozenAppeal:'如對凍結有異議，請通過郵箱 support@btcbox.com 申訴', gotIt:'我知道了', opFailed:'操作失敗，請重試', googleSuccess:'Google 帳號登入成功', invalidEmail:'請輸入有效的郵箱地址', googleFail:'Google 登入失敗，請重試', resetPwdTitle:'重置密碼', resetPwdBody:'為保障帳戶安全，密碼重置需通過在線客服人工核驗身份後辦理。請聯繫在線客服協助重置。', contactSupport:'聯繫在線客服', copyright:'數位資產交易涉及風險，請謹慎投資', agreePrefix:'即表示同意'},
    'en': {confirmPassword:'Confirm Password', confirmPwdPh:'Re-enter password', registerAndLogin:'Sign Up & Log In', orDivider:'or', haveAccount:'Already have an account?', goLogin:'Log In →', submiting:'Submitting...', fillAll:'Please fill in all fields', pwdMismatch:'Passwords do not match', regSuccess:'Registered and logged in', loginSuccess:'Logged in', please6code:'Enter 6-digit code', twofaTitle:'Two-Factor Authentication', twofaBody:'Your account has 2FA enabled. Enter the 6-digit code from Google Authenticator.', confirmLogin:'Confirm Log In', frozenTitle:'Account Frozen', frozenAppeal:'If you disagree with the freeze, please appeal via support@btcbox.com', gotIt:'Got it', opFailed:'Operation failed, please retry', googleSuccess:'Signed in with Google', invalidEmail:'Please enter a valid email', googleFail:'Google sign-in failed, please retry', resetPwdTitle:'Reset Password', resetPwdBody:'For security, password reset requires manual identity verification via online support. Please contact support.', contactSupport:'Contact Support', copyright:'Digital asset trading involves risk. Invest wisely.', agreePrefix:'By continuing, you agree to'},
    'ja': {confirmPassword:'パスワード確認', confirmPwdPh:'パスワードを再入力', registerAndLogin:'登録してログイン', orDivider:'または', haveAccount:'アカウントをお持ちですか？', goLogin:'ログインへ', submiting:'送信中...', fillAll:'すべての項目を入力してください', pwdMismatch:'パスワードが一致しません', regSuccess:'登録が完了しました', loginSuccess:'ログインしました', please6code:'6桁のコードを入力', twofaTitle:'二段階認証', twofaBody:'アカウントで二段階認証が有効です。Google Authenticatorの6桁コードを入力してください。', confirmLogin:'ログインを確認', frozenTitle:'アカウントが凍結されました', frozenAppeal:'凍結に異議がある場合は、support@btcbox.com までご連絡ください', gotIt:'了解', opFailed:'操作に失敗しました。再試行してください', googleSuccess:'Googleでログインしました', invalidEmail:'有効なメールアドレスを入力してください', googleFail:'Googleログインに失敗しました。再試行してください', resetPwdTitle:'パスワードリセット', resetPwdBody:'セキュリティのため、パスワードリセットはオンラインサポートでの本人確認が必要です。サポートにお問い合わせください。', contactSupport:'サポートに連絡', copyright:'暗号資産取引にはリスクがあります。慎重に投資してください。', agreePrefix:'続行することで、以下に同意します'},
    'ko': {confirmPassword:'비밀번호 확인', confirmPwdPh:'비밀번호를 다시 입력하세요', registerAndLogin:'가입하고 로그인', orDivider:'또는', haveAccount:'이미 계정이 있으신가요?', goLogin:'로그인하기', submiting:'제출 중...', fillAll:'모든 항목을 입력해 주세요', pwdMismatch:'비밀번호가 일치하지 않습니다', regSuccess:'가입 및 로그인 성공', loginSuccess:'로그인되었습니다', please6code:'6자리 코드를 입력하세요', twofaTitle:'2단계 인증', twofaBody:'계정에서 2단계 인증이 활성화되어 있습니다. Google Authenticator의 6자리 코드를 입력하세요.', confirmLogin:'로그인 확인', frozenTitle:'계정이 동결되었습니다', frozenAppeal:'동결에 이의가 있으시면 support@btcbox.com 으로 문의해 주세요', gotIt:'확인', opFailed:'작업에 실패했습니다. 다시 시도해 주세요', googleSuccess:'Google로 로그인되었습니다', invalidEmail:'유효한 이메일을 입력해 주세요', googleFail:'Google 로그인에 실패했습니다. 다시 시도해 주세요', resetPwdTitle:'비밀번호 재설정', resetPwdBody:'보안을 위해 비밀번호 재설정은 온라인 지원을 통한 본인 확인이 필요합니다. 지원팀에 문의해 주세요.', contactSupport:'지원팀에 문의', copyright:'디지털 자산 거래에는 위험이 있습니다. 신중히 투자하세요.', agreePrefix:'계속하면 다음에 동의합니다'},
    'vi': {confirmPassword:'Xác nhận mật khẩu', confirmPwdPh:'Nhập lại mật khẩu', registerAndLogin:'Đăng ký & Đăng nhập', orDivider:'hoặc', haveAccount:'Đã có tài khoản?', goLogin:'Đăng nhập →', submiting:'Đang gửi...', fillAll:'Vui lòng điền đầy đủ thông tin', pwdMismatch:'Mật khẩu không khớp', regSuccess:'Đăng ký thành công', loginSuccess:'Đã đăng nhập', please6code:'Nhập mã 6 số', twofaTitle:'Xác thực hai yếu tố', twofaBody:'Tài khoản của bạn đã bật 2FA. Nhập mã 6 số từ Google Authenticator.', confirmLogin:'Xác nhận đăng nhập', frozenTitle:'Tài khoản bị khóa', frozenAppeal:'Nếu không đồng ý với việc khóa, vui lòng khiếu nại qua support@btcbox.com', gotIt:'Đã hiểu', opFailed:'Thao tác thất bại, vui lòng thử lại', googleSuccess:'Đăng nhập bằng Google thành công', invalidEmail:'Vui lòng nhập email hợp lệ', googleFail:'Đăng nhập Google thất bại, vui lòng thử lại', resetPwdTitle:'Đặt lại mật khẩu', resetPwdBody:'Vì lý do bảo mật, đặt lại mật khẩu cần xác minh danh tính qua hỗ trợ trực tuyến. Vui lòng liên hệ hỗ trợ.', contactSupport:'Liên hệ hỗ trợ', copyright:'Giao dịch tài sản số có rủi ro. Hãy đầu tư thận trọng.', agreePrefix:'Bằng việc tiếp tục, bạn đồng ý với'}
  };
  Object.keys(PATCH).forEach(function(lang){
    if(DICT[lang]){ Object.keys(PATCH[lang]).forEach(function(k){ if(!DICT[lang][k]) DICT[lang][k] = PATCH[lang][k]; }); }
  });

  var SUPPORTED = ['zh-CN','zh-TW','en','ja','ko','vi'];
  var currentLang = 'zh-CN';
  var STORAGE_KEY = 'btcbox_lang';

  function detectLang(){
    // 1. localStorage 优先（用户手动选择过）
    try{
      var saved = localStorage.getItem(STORAGE_KEY);
      if(saved && DICT[saved]) return saved;
    }catch(e){}
    // 2. 浏览器语言
    var nav = (navigator.language || navigator.userLanguage || 'zh-CN');
    var lang = nav.replace('_','-');
    // 精确匹配
    if(DICT[lang]) return lang;
    // 前缀匹配（zh → zh-CN，en-US → en）
    var prefix = lang.split('-')[0].toLowerCase();
    for(var i=0;i<SUPPORTED.length;i++){
      if(SUPPORTED[i].toLowerCase().indexOf(prefix) === 0) return SUPPORTED[i];
    }
    // 3. 默认英文（非中文/日韩越用户）
    return 'en';
  }

  function t(key){
    var dict = DICT[currentLang] || DICT['zh-CN'];
    return dict[key] || DICT['zh-CN'][key] || key;
  }

  function apply(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      var text = t(key);
      if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
        el.placeholder = text;
      } else if(el.tagName === 'OPTION'){
        el.textContent = text;
      } else {
        el.textContent = text;
      }
    });
    // 设置 html lang 属性
    document.documentElement.setAttribute('lang', currentLang);
    // 通知全局（app.js 底部导航等动态内容监听此事件重新渲染）
    document.dispatchEvent(new CustomEvent('langChange', {detail:{lang:currentLang}}));
  }

  function setLang(lang){
    if(!DICT[lang]) return false;
    currentLang = lang;
    try{ localStorage.setItem(STORAGE_KEY, lang); }catch(e){}
    apply();
    return true;
  }

  function getLang(){ return currentLang; }
  function getSupported(){ return SUPPORTED.slice(); }

  // 初始化
  currentLang = detectLang();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  global.I18N = { t:t, setLang:setLang, getLang:getLang, getSupported:getSupported, apply:apply, DICT:DICT };
})(window);
