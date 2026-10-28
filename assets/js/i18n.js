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
      platformTitle:'专业的数字资产交易平台', ssl:'SSL 加密传输', support24:'在线客户支持', cold98:'98% 资产冷存储',
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
      platformTitle:'專業的數位資產交易平台', ssl:'SSL 加密傳輸', support24:'線上客戶支援', cold98:'98% 資產冷儲存',
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
      platformTitle:'Professional Digital Asset Exchange', ssl:'SSL Encrypted', support24:'Customer Support', cold98:'98% Cold Storage',
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
      platformTitle:'プロフェッショナル暗号資産取引所', ssl:'SSL暗号化', support24:'カスタマーサポート', cold98:'98% コールドウォレット',
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
      platformTitle:'프로페셔널 디지털 자산 거래소', ssl:'SSL 암호화', support24:'고객 지원', cold98:'98% 콜드월렛',
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
      platformTitle:'Sàn giao dịch tài sản số chuyên nghiệp', ssl:'Mã hóa SSL', support24:'Hỗ trợ khách hàng', cold98:'98% Ví lạnh',
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
    'zh-CN': {kycVerified:'已实名认证', kycPending:'审核中', kycUnverified:'未实名认证', settlementWaiting:'等待结算', settlementWin:'结算：+$xxx.xx', settlementLoss:'结算：-$xxx.xx', submitSuccess:'提交成功', operationFailed:'操作失败', networkException:'网络异常', insufficientBalance:'余额不足', contactSupportReset:'请联系客服重置密码', contactSupportAction:'请联系客服处理', kycLocked:'认证资料已锁定', confirmPassword:'确认密码', confirmPwdPh:'请再次输入密码', registerAndLogin:'注册并登录', orDivider:'或', haveAccount:'已有账号？', goLogin:'去登录', submiting:'提交中...', fillAll:'请填写完整信息', pwdMismatch:'两次输入的密码不一致', regSuccess:'注册成功，已登录', loginSuccess:'登录成功', please6code:'请输入6位验证码', twofaTitle:'双重验证', twofaBody:'您的账号已开启双重验证，请输入 Google Authenticator 中的 6 位验证码', confirmLogin:'确认登录', frozenTitle:'账号已被冻结', frozenAppeal:'如对冻结有异议，请通过邮箱 support@btcbox.com 申诉', gotIt:'我知道了', opFailed:'操作失败，请重试', googleSuccess:'Google 账号登录成功', invalidEmail:'请输入有效的邮箱地址', googleFail:'Google 登录失败，请重试', resetPwdTitle:'重置密码', resetPwdBody:'为保障账户安全，密码重置需通过在线客服人工核验身份后办理。请联系在线客服协助重置。', contactSupport:'联系在线客服', copyright:'数字资产交易涉及风险，请谨慎投资', agreePrefix:'即表示同意'},
    'zh-TW': {kycVerified:'已完成實名認證', kycPending:'審核中', kycUnverified:'未實名認證', settlementWaiting:'等待結算', settlementWin:'結算：+$xxx.xx', settlementLoss:'結算：-$xxx.xx', submitSuccess:'提交成功', operationFailed:'操作失敗', networkException:'網路異常', insufficientBalance:'餘額不足', contactSupportReset:'請聯絡客服重設密碼', contactSupportAction:'請聯絡客服處理', kycLocked:'認證資料已鎖定', confirmPassword:'確認密碼', confirmPwdPh:'請再次輸入密碼', registerAndLogin:'註冊並登入', orDivider:'或', haveAccount:'已有帳號？', goLogin:'去登入', submiting:'提交中...', fillAll:'請填寫完整資訊', pwdMismatch:'兩次輸入的密碼不一致', regSuccess:'註冊成功，已登入', loginSuccess:'登入成功', please6code:'請輸入6位驗證碼', twofaTitle:'雙重驗證', twofaBody:'您的帳號已開啟雙重驗證，請輸入 Google Authenticator 中的 6 位驗證碼', confirmLogin:'確認登入', frozenTitle:'帳號已被凍結', frozenAppeal:'如對凍結有異議，請通過郵箱 support@btcbox.com 申訴', gotIt:'我知道了', opFailed:'操作失敗，請重試', googleSuccess:'Google 帳號登入成功', invalidEmail:'請輸入有效的郵箱地址', googleFail:'Google 登入失敗，請重試', resetPwdTitle:'重置密碼', resetPwdBody:'為保障帳戶安全，密碼重置需通過在線客服人工核驗身份後辦理。請聯繫在線客服協助重置。', contactSupport:'聯繫在線客服', copyright:'數位資產交易涉及風險，請謹慎投資', agreePrefix:'即表示同意'},
    'en': {kycVerified:'Identity verified', kycPending:'Under review', kycUnverified:'Identity not verified', settlementWaiting:'Awaiting settlement', settlementWin:'Settled: +$xxx.xx', settlementLoss:'Settled: -$xxx.xx', submitSuccess:'Submitted successfully', operationFailed:'Operation failed', networkException:'Network error', insufficientBalance:'Insufficient balance', contactSupportReset:'Please contact support to reset your password', contactSupportAction:'Please contact support', kycLocked:'Verification details are locked', confirmPassword:'Confirm Password', confirmPwdPh:'Re-enter password', registerAndLogin:'Sign Up & Log In', orDivider:'or', haveAccount:'Already have an account?', goLogin:'Log In →', submiting:'Submitting...', fillAll:'Please fill in all fields', pwdMismatch:'Passwords do not match', regSuccess:'Registered and logged in', loginSuccess:'Logged in', please6code:'Enter 6-digit code', twofaTitle:'Two-Factor Authentication', twofaBody:'Your account has 2FA enabled. Enter the 6-digit code from Google Authenticator.', confirmLogin:'Confirm Log In', frozenTitle:'Account Frozen', frozenAppeal:'If you disagree with the freeze, please appeal via support@btcbox.com', gotIt:'Got it', opFailed:'Operation failed, please retry', googleSuccess:'Signed in with Google', invalidEmail:'Please enter a valid email', googleFail:'Google sign-in failed, please retry', resetPwdTitle:'Reset Password', resetPwdBody:'For security, password reset requires manual identity verification via online support. Please contact support.', contactSupport:'Contact Support', copyright:'Digital asset trading involves risk. Invest wisely.', agreePrefix:'By continuing, you agree to'},
    'ja': {kycVerified:'本人確認済み', kycPending:'審査中', kycUnverified:'本人確認未完了', settlementWaiting:'決済待ち', settlementWin:'決済：+$xxx.xx', settlementLoss:'決済：-$xxx.xx', submitSuccess:'送信しました', operationFailed:'操作に失敗しました', networkException:'ネットワークエラー', insufficientBalance:'残高不足', contactSupportReset:'パスワードのリセットはサポートにお問い合わせください', contactSupportAction:'サポートにお問い合わせください', kycLocked:'認証情報はロックされています', confirmPassword:'パスワード確認', confirmPwdPh:'パスワードを再入力', registerAndLogin:'登録してログイン', orDivider:'または', haveAccount:'アカウントをお持ちですか？', goLogin:'ログインへ', submiting:'送信中...', fillAll:'すべての項目を入力してください', pwdMismatch:'パスワードが一致しません', regSuccess:'登録が完了しました', loginSuccess:'ログインしました', please6code:'6桁のコードを入力', twofaTitle:'二段階認証', twofaBody:'アカウントで二段階認証が有効です。Google Authenticatorの6桁コードを入力してください。', confirmLogin:'ログインを確認', frozenTitle:'アカウントが凍結されました', frozenAppeal:'凍結に異議がある場合は、support@btcbox.com までご連絡ください', gotIt:'了解', opFailed:'操作に失敗しました。再試行してください', googleSuccess:'Googleでログインしました', invalidEmail:'有効なメールアドレスを入力してください', googleFail:'Googleログインに失敗しました。再試行してください', resetPwdTitle:'パスワードリセット', resetPwdBody:'セキュリティのため、パスワードリセットはオンラインサポートでの本人確認が必要です。サポートにお問い合わせください。', contactSupport:'サポートに連絡', copyright:'暗号資産取引にはリスクがあります。慎重に投資してください。', agreePrefix:'続行することで、以下に同意します'},
    'ko': {kycVerified:'본인 인증 완료', kycPending:'검토 중', kycUnverified:'본인 미인증', settlementWaiting:'정산 대기 중', settlementWin:'정산: +$xxx.xx', settlementLoss:'정산: -$xxx.xx', submitSuccess:'제출 성공', operationFailed:'작업 실패', networkException:'네트워크 오류', insufficientBalance:'잔액 부족', contactSupportReset:'비밀번호 재설정은 고객 지원에 문의하세요', contactSupportAction:'고객 지원에 문의하세요', kycLocked:'인증 정보가 잠겼습니다', confirmPassword:'비밀번호 확인', confirmPwdPh:'비밀번호를 다시 입력하세요', registerAndLogin:'가입하고 로그인', orDivider:'또는', haveAccount:'이미 계정이 있으신가요?', goLogin:'로그인하기', submiting:'제출 중...', fillAll:'모든 항목을 입력해 주세요', pwdMismatch:'비밀번호가 일치하지 않습니다', regSuccess:'가입 및 로그인 성공', loginSuccess:'로그인되었습니다', please6code:'6자리 코드를 입력하세요', twofaTitle:'2단계 인증', twofaBody:'계정에서 2단계 인증이 활성화되어 있습니다. Google Authenticator의 6자리 코드를 입력하세요.', confirmLogin:'로그인 확인', frozenTitle:'계정이 동결되었습니다', frozenAppeal:'동결에 이의가 있으시면 support@btcbox.com 으로 문의해 주세요', gotIt:'확인', opFailed:'작업에 실패했습니다. 다시 시도해 주세요', googleSuccess:'Google로 로그인되었습니다', invalidEmail:'유효한 이메일을 입력해 주세요', googleFail:'Google 로그인에 실패했습니다. 다시 시도해 주세요', resetPwdTitle:'비밀번호 재설정', resetPwdBody:'보안을 위해 비밀번호 재설정은 온라인 지원을 통한 본인 확인이 필요합니다. 지원팀에 문의해 주세요.', contactSupport:'지원팀에 문의', copyright:'디지털 자산 거래에는 위험이 있습니다. 신중히 투자하세요.', agreePrefix:'계속하면 다음에 동의합니다'},
    'vi': {kycVerified:'Đã xác minh danh tính', kycPending:'Đang xét duyệt', kycUnverified:'Chưa xác minh danh tính', settlementWaiting:'Đang chờ quyết toán', settlementWin:'Quyết toán: +$xxx.xx', settlementLoss:'Quyết toán: -$xxx.xx', submitSuccess:'Gửi thành công', operationFailed:'Thao tác thất bại', networkException:'Lỗi mạng', insufficientBalance:'Số dư không đủ', contactSupportReset:'Vui lòng liên hệ hỗ trợ để đặt lại mật khẩu', contactSupportAction:'Vui lòng liên hệ hỗ trợ', kycLocked:'Thông tin xác minh đã bị khóa', confirmPassword:'Xác nhận mật khẩu', confirmPwdPh:'Nhập lại mật khẩu', registerAndLogin:'Đăng ký & Đăng nhập', orDivider:'hoặc', haveAccount:'Đã có tài khoản?', goLogin:'Đăng nhập →', submiting:'Đang gửi...', fillAll:'Vui lòng điền đầy đủ thông tin', pwdMismatch:'Mật khẩu không khớp', regSuccess:'Đăng ký thành công', loginSuccess:'Đã đăng nhập', please6code:'Nhập mã 6 số', twofaTitle:'Xác thực hai yếu tố', twofaBody:'Tài khoản của bạn đã bật 2FA. Nhập mã 6 số từ Google Authenticator.', confirmLogin:'Xác nhận đăng nhập', frozenTitle:'Tài khoản bị khóa', frozenAppeal:'Nếu không đồng ý với việc khóa, vui lòng khiếu nại qua support@btcbox.com', gotIt:'Đã hiểu', opFailed:'Thao tác thất bại, vui lòng thử lại', googleSuccess:'Đăng nhập bằng Google thành công', invalidEmail:'Vui lòng nhập email hợp lệ', googleFail:'Đăng nhập Google thất bại, vui lòng thử lại', resetPwdTitle:'Đặt lại mật khẩu', resetPwdBody:'Vì lý do bảo mật, đặt lại mật khẩu cần xác minh danh tính qua hỗ trợ trực tuyến. Vui lòng liên hệ hỗ trợ.', contactSupport:'Liên hệ hỗ trợ', copyright:'Giao dịch tài sản số có rủi ro. Hãy đầu tư thận trọng.', agreePrefix:'Bằng việc tiếp tục, bạn đồng ý với'}
  };
  // Round 130: user-facing auth, transaction, and service feedback; every key exists in all locales.
  var ROUND130_LOCALE_PATCH = {
    'zh-CN': {registerSuccess:'注册成功，已登录', loginSuccessMessage:'登录成功', submitting:'提交中...', twofaUnavailable:'双重验证服务暂不可用，请稍后重试', invalidVerificationCode:'验证码错误，请重试', frozenAccountBody:'您的账户目前已被冻结，暂时无法登录。', frozenAppeal:'如对账户限制有异议，请联系 support@btcbox.com 申诉。', gotIt:'我知道了', operationFailedRetry:'操作失败，请重试', verificationFailed:'登录验证失败，请重试。', emailSignInSuccess:'邮箱登录成功', googleSignInSuccess:'Google 登录成功', googleStartFailed:'无法启动 Google 登录，请检查网络或 OAuth 配置。', emailLinkInvalid:'此邮箱登录链接无效、已过期或已使用。请重新申请登录链接。', googleAuthIncomplete:'Google 授权未完成，请重试。', emailLinkExpired:'此邮箱登录链接无法验证或已过期。请在同一浏览器中打开最新邮件链接，或重新申请。', authVerifyFailed:'登录验证失败，请重试；如问题持续，请联系客服。', authServiceUnavailable:'登录服务暂时无法加载，请刷新页面后重试。', addressFetchFailed:'获取地址失败，请稍后重试', submitFailed:'提交失败，请重试', insufficientBalanceWithFee:'余额不足（含手续费）', orderPlaced:'订单已提交', orderFailedMessage:'下单失败，请重试', assetHidden:'资产已隐藏', assetShown:'资产已显示', supportHistoryRefreshFailed:'消息已发送，但暂时无法刷新历史记录', messageSendFailed:'发送失败，请重试', copySecretSuccess:'密钥已复制', switchedToValue:'已切换为', redeemConfirmTitle:'确认赎回', redeemConfirmBody:'提前赎回可能会产生手续费。确定要赎回这笔持仓吗？', confirmRedeem:'确认赎回', marketPrice:'市价', newAddressPlaceholder:'请输入新地址', readingBoundAddress:'正在读取已绑定地址…', networkUnavailable:'网络异常，请检查连接后重试', addressSaved:'提交成功', noBoundAddress:'暂无绑定地址', contactSupportForAddress:'请联系客服处理', orderOpenEmpty:'暂无委托，下单后将在此显示', noPositions:'暂无持仓', noTradeHistory:'暂无历史成交', positionOpened:'已开仓', upDirection:'看涨', downDirection:'看跌', copy:'复制'},
    'zh-TW': {registerSuccess:'註冊成功，已登入', loginSuccessMessage:'登入成功', submitting:'提交中...', twofaUnavailable:'雙重驗證服務暫時無法使用，請稍後再試', invalidVerificationCode:'驗證碼錯誤，請重試', frozenAccountBody:'您的帳戶目前已被凍結，暫時無法登入。', frozenAppeal:'如對帳戶限制有異議，請聯絡 support@btcbox.com 申訴。', gotIt:'我知道了', operationFailedRetry:'操作失敗，請重試', verificationFailed:'登入驗證失敗，請重試。', emailSignInSuccess:'電子郵件登入成功', googleSignInSuccess:'Google 登入成功', googleStartFailed:'無法啟動 Google 登入，請檢查網路或 OAuth 設定。', emailLinkInvalid:'此電子郵件登入連結無效、已過期或已使用。請重新申請登入連結。', googleAuthIncomplete:'Google 授權未完成，請重試。', emailLinkExpired:'此電子郵件登入連結無法驗證或已過期。請在同一瀏覽器中開啟最新郵件連結，或重新申請。', authVerifyFailed:'登入驗證失敗，請重試；如問題持續，請聯絡客服。', authServiceUnavailable:'登入服務暫時無法載入，請重新整理頁面後再試。', addressFetchFailed:'取得地址失敗，請稍後再試', submitFailed:'提交失敗，請重試', insufficientBalanceWithFee:'餘額不足（含手續費）', orderPlaced:'訂單已提交', orderFailedMessage:'下單失敗，請重試', assetHidden:'資產已隱藏', assetShown:'資產已顯示', supportHistoryRefreshFailed:'訊息已送出，但暫時無法重新整理歷史紀錄', messageSendFailed:'傳送失敗，請重試', copySecretSuccess:'密鑰已複製', switchedToValue:'已切換為', redeemConfirmTitle:'確認贖回', redeemConfirmBody:'提前贖回可能會產生手續費。確定要贖回這筆持倉嗎？', confirmRedeem:'確認贖回', marketPrice:'市價', newAddressPlaceholder:'請輸入新地址', readingBoundAddress:'正在讀取已綁定地址…', networkUnavailable:'網路異常，請檢查連線後重試', addressSaved:'提交成功', noBoundAddress:'暫無綁定地址', contactSupportForAddress:'請聯絡客服處理', orderOpenEmpty:'暫無委託，下單後將在此顯示', noPositions:'暫無持倉', noTradeHistory:'暫無歷史成交', positionOpened:'已開倉', upDirection:'看漲', downDirection:'看跌', copy:'複製'},
    'en': {registerSuccess:'Registration successful. You are now signed in.', loginSuccessMessage:'Signed in successfully', submitting:'Submitting...', twofaUnavailable:'Two-factor authentication is temporarily unavailable. Please try again later.', invalidVerificationCode:'Invalid verification code. Please try again.', frozenAccountBody:'Your account is currently frozen, so sign-in is unavailable.', frozenAppeal:'If you believe this restriction is a mistake, contact support@btcbox.com to appeal.', gotIt:'Got it', operationFailedRetry:'The operation failed. Please try again.', verificationFailed:'Sign-in verification failed. Please try again.', emailSignInSuccess:'Email sign-in successful', googleSignInSuccess:'Google sign-in successful', googleStartFailed:'Unable to start Google sign-in. Check your connection or OAuth configuration.', emailLinkInvalid:'This email sign-in link is invalid, expired, or already used. Request a new link.', googleAuthIncomplete:'Google authorization was not completed. Please try again.', emailLinkExpired:'This email link could not be verified or has expired. Open the latest email link in the same browser, or request a new one.', authVerifyFailed:'Sign-in verification failed. Please try again. If the problem continues, contact support.', authServiceUnavailable:'The sign-in service is temporarily unavailable. Refresh the page and try again.', addressFetchFailed:'Unable to retrieve the address. Please try again later.', submitFailed:'Submission failed. Please try again.', insufficientBalanceWithFee:'Insufficient balance, including the fee.', orderPlaced:'Order submitted successfully', orderFailedMessage:'Order failed. Please try again.', assetHidden:'Assets are now hidden', assetShown:'Assets are now visible', supportHistoryRefreshFailed:'Your message was sent, but message history could not be refreshed.', messageSendFailed:'Message could not be sent. Please try again.', copySecretSuccess:'Secret copied', switchedToValue:'Switched to', redeemConfirmTitle:'Confirm redemption', redeemConfirmBody:'Early redemption may incur a fee. Do you want to redeem this holding?', confirmRedeem:'Confirm redemption', marketPrice:'Market price', newAddressPlaceholder:'Enter a new address', readingBoundAddress:'Loading the saved address…', networkUnavailable:'Network error. Check your connection and try again.', addressSaved:'Submitted successfully', noBoundAddress:'No saved addresses', contactSupportForAddress:'Contact support for assistance', orderOpenEmpty:'No open orders. Place an order to see it here.', noPositions:'No open positions', noTradeHistory:'No trade history', positionOpened:'Position opened', upDirection:'Up', downDirection:'Down', copy:'Copy'},
    'ja': {registerSuccess:'登録が完了し、ログインしました', loginSuccessMessage:'ログインしました', submitting:'送信中...', twofaUnavailable:'二要素認証サービスは一時的に利用できません。後でもう一度お試しください。', invalidVerificationCode:'認証コードが正しくありません。再試行してください。', frozenAccountBody:'アカウントは凍結されているため、現在ログインできません。', frozenAppeal:'制限に異議がある場合は support@btcbox.com までお問い合わせください。', gotIt:'了解', operationFailedRetry:'操作に失敗しました。再試行してください。', verificationFailed:'ログイン認証に失敗しました。再試行してください。', emailSignInSuccess:'メールでログインしました', googleSignInSuccess:'Googleでログインしました', googleStartFailed:'Googleログインを開始できません。ネットワークまたはOAuth設定を確認してください。', emailLinkInvalid:'メールログインリンクが無効、期限切れ、または使用済みです。新しいリンクをリクエストしてください。', googleAuthIncomplete:'Google認証が完了しませんでした。再試行してください。', emailLinkExpired:'メールリンクを検証できないか、期限切れです。同じブラウザで最新のメールリンクを開くか、再申請してください。', authVerifyFailed:'ログイン認証に失敗しました。再試行し、解決しない場合はサポートにお問い合わせください。', authServiceUnavailable:'ログインサービスを読み込めません。ページを更新して再試行してください。', addressFetchFailed:'アドレスを取得できません。後でもう一度お試しください。', submitFailed:'送信に失敗しました。再試行してください。', insufficientBalanceWithFee:'手数料を含む残高が不足しています。', orderPlaced:'注文を送信しました', orderFailedMessage:'注文に失敗しました。再試行してください。', assetHidden:'資産を非表示にしました', assetShown:'資産を表示しました', supportHistoryRefreshFailed:'メッセージは送信されましたが、履歴を更新できませんでした。', messageSendFailed:'メッセージを送信できません。再試行してください。', copySecretSuccess:'シークレットをコピーしました', switchedToValue:'切り替え先：', redeemConfirmTitle:'償還の確認', redeemConfirmBody:'早期償還には手数料が発生する場合があります。この保有分を償還しますか？', confirmRedeem:'償還を確認', marketPrice:'成行価格', newAddressPlaceholder:'新しいアドレスを入力', readingBoundAddress:'登録済みアドレスを読み込み中…', networkUnavailable:'ネットワークエラーです。接続を確認して再試行してください。', addressSaved:'送信しました', noBoundAddress:'登録済みアドレスはありません', contactSupportForAddress:'サポートにお問い合わせください', orderOpenEmpty:'未約定注文はありません', noPositions:'ポジションはありません', noTradeHistory:'取引履歴はありません', positionOpened:'ポジションを開きました', upDirection:'上昇', downDirection:'下降', copy:'コピー'},
    'ko': {registerSuccess:'가입 및 로그인이 완료되었습니다', loginSuccessMessage:'로그인되었습니다', submitting:'제출 중...', twofaUnavailable:'2단계 인증 서비스를 일시적으로 사용할 수 없습니다. 나중에 다시 시도하세요.', invalidVerificationCode:'인증 코드가 올바르지 않습니다. 다시 시도하세요.', frozenAccountBody:'계정이 동결되어 현재 로그인할 수 없습니다.', frozenAppeal:'제한에 이의가 있으면 support@btcbox.com으로 문의해 주세요.', gotIt:'확인', operationFailedRetry:'작업에 실패했습니다. 다시 시도하세요.', verificationFailed:'로그인 확인에 실패했습니다. 다시 시도하세요.', emailSignInSuccess:'이메일 로그인 성공', googleSignInSuccess:'Google 로그인 성공', googleStartFailed:'Google 로그인을 시작할 수 없습니다. 네트워크 또는 OAuth 설정을 확인하세요.', emailLinkInvalid:'이메일 로그인 링크가 유효하지 않거나 만료되었거나 이미 사용되었습니다. 새 링크를 요청하세요.', googleAuthIncomplete:'Google 인증이 완료되지 않았습니다. 다시 시도하세요.', emailLinkExpired:'이메일 링크를 확인할 수 없거나 만료되었습니다. 같은 브라우저에서 최신 이메일 링크를 열거나 다시 요청하세요.', authVerifyFailed:'로그인 확인에 실패했습니다. 다시 시도하고 문제가 계속되면 고객 지원에 문의하세요.', authServiceUnavailable:'로그인 서비스를 불러올 수 없습니다. 페이지를 새로고침하고 다시 시도하세요.', addressFetchFailed:'주소를 가져올 수 없습니다. 나중에 다시 시도하세요.', submitFailed:'제출에 실패했습니다. 다시 시도하세요.', insufficientBalanceWithFee:'수수료를 포함한 잔액이 부족합니다.', orderPlaced:'주문이 제출되었습니다', orderFailedMessage:'주문에 실패했습니다. 다시 시도하세요.', assetHidden:'자산을 숨겼습니다', assetShown:'자산을 표시했습니다', supportHistoryRefreshFailed:'메시지를 보냈지만 기록을 새로고침하지 못했습니다.', messageSendFailed:'메시지를 보내지 못했습니다. 다시 시도하세요.', copySecretSuccess:'비밀 키를 복사했습니다', switchedToValue:'전환됨:', redeemConfirmTitle:'상환 확인', redeemConfirmBody:'조기 상환 시 수수료가 발생할 수 있습니다. 이 보유 자산을 상환하시겠습니까?', confirmRedeem:'상환 확인', marketPrice:'시장 가격', newAddressPlaceholder:'새 주소를 입력하세요', readingBoundAddress:'저장된 주소를 불러오는 중…', networkUnavailable:'네트워크 오류입니다. 연결을 확인하고 다시 시도하세요.', addressSaved:'제출되었습니다', noBoundAddress:'저장된 주소가 없습니다', contactSupportForAddress:'고객 지원에 문의하세요', orderOpenEmpty:'미체결 주문이 없습니다', noPositions:'포지션이 없습니다', noTradeHistory:'거래 내역이 없습니다', positionOpened:'포지션이 열렸습니다', upDirection:'상승', downDirection:'하락', copy:'복사'},
    'vi': {registerSuccess:'Đăng ký thành công và đã đăng nhập', loginSuccessMessage:'Đăng nhập thành công', submitting:'Đang gửi...', twofaUnavailable:'Dịch vụ xác thực hai yếu tố tạm thời không khả dụng. Vui lòng thử lại sau.', invalidVerificationCode:'Mã xác minh không hợp lệ. Vui lòng thử lại.', frozenAccountBody:'Tài khoản của bạn đang bị đóng băng nên hiện không thể đăng nhập.', frozenAppeal:'Nếu bạn cho rằng hạn chế này không chính xác, hãy liên hệ support@btcbox.com để khiếu nại.', gotIt:'Đã hiểu', operationFailedRetry:'Thao tác thất bại. Vui lòng thử lại.', verificationFailed:'Xác minh đăng nhập thất bại. Vui lòng thử lại.', emailSignInSuccess:'Đăng nhập bằng email thành công', googleSignInSuccess:'Đăng nhập Google thành công', googleStartFailed:'Không thể bắt đầu đăng nhập Google. Hãy kiểm tra kết nối hoặc cấu hình OAuth.', emailLinkInvalid:'Liên kết đăng nhập email không hợp lệ, đã hết hạn hoặc đã được sử dụng. Hãy yêu cầu liên kết mới.', googleAuthIncomplete:'Quá trình ủy quyền Google chưa hoàn tất. Vui lòng thử lại.', emailLinkExpired:'Không thể xác minh liên kết email hoặc liên kết đã hết hạn. Hãy mở liên kết mới nhất trong cùng trình duyệt hoặc yêu cầu lại.', authVerifyFailed:'Xác minh đăng nhập thất bại. Vui lòng thử lại; nếu vẫn gặp sự cố, hãy liên hệ hỗ trợ.', authServiceUnavailable:'Không thể tải dịch vụ đăng nhập. Hãy làm mới trang và thử lại.', addressFetchFailed:'Không thể lấy địa chỉ. Vui lòng thử lại sau.', submitFailed:'Gửi thất bại. Vui lòng thử lại.', insufficientBalanceWithFee:'Số dư không đủ, bao gồm cả phí.', orderPlaced:'Đã gửi lệnh thành công', orderFailedMessage:'Đặt lệnh thất bại. Vui lòng thử lại.', assetHidden:'Đã ẩn tài sản', assetShown:'Đã hiện tài sản', supportHistoryRefreshFailed:'Tin nhắn đã được gửi nhưng không thể làm mới lịch sử.', messageSendFailed:'Không thể gửi tin nhắn. Vui lòng thử lại.', copySecretSuccess:'Đã sao chép khóa bí mật', switchedToValue:'Đã chuyển sang', redeemConfirmTitle:'Xác nhận tất toán', redeemConfirmBody:'Tất toán sớm có thể phát sinh phí. Bạn có muốn tất toán khoản nắm giữ này không?', confirmRedeem:'Xác nhận tất toán', marketPrice:'Giá thị trường', newAddressPlaceholder:'Nhập địa chỉ mới', readingBoundAddress:'Đang tải địa chỉ đã lưu…', networkUnavailable:'Lỗi mạng. Hãy kiểm tra kết nối và thử lại.', addressSaved:'Gửi thành công', noBoundAddress:'Chưa có địa chỉ đã lưu', contactSupportForAddress:'Vui lòng liên hệ hỗ trợ', orderOpenEmpty:'Chưa có lệnh mở. Hãy đặt lệnh để xem tại đây.', noPositions:'Chưa có vị thế', noTradeHistory:'Chưa có lịch sử giao dịch', positionOpened:'Đã mở vị thế', upDirection:'Tăng', downDirection:'Giảm', copy:'Sao chép'}
  };
  Object.keys(ROUND130_LOCALE_PATCH).forEach(function(lang){
    Object.keys(ROUND130_LOCALE_PATCH[lang]).forEach(function(key){ DICT[lang][key] = ROUND130_LOCALE_PATCH[lang][key]; });
  });

  // Round 129: localized safety keys for language switching and missing translations.
  var ROUND129_LOCALE_PATCH = {
    'zh-CN': {langSwitched:'语言已切换', translationUnavailable:'此内容暂未提供当前语言版本'},
    'zh-TW': {langSwitched:'語言已切換', translationUnavailable:'此內容暫未提供目前語言版本'},
    'en': {langSwitched:'Language changed', translationUnavailable:'This content is not yet available in the selected language'},
    'ja': {langSwitched:'言語を切り替えました', translationUnavailable:'この内容は選択した言語ではまだ利用できません'},
    'ko': {langSwitched:'언어가 변경되었습니다', translationUnavailable:'이 콘텐츠는 선택한 언어로 아직 제공되지 않습니다'},
    'vi': {langSwitched:'Đã đổi ngôn ngữ', translationUnavailable:'Nội dung này chưa có bản dịch sang ngôn ngữ đã chọn'}
  };
  Object.keys(ROUND129_LOCALE_PATCH).forEach(function(lang){
    Object.keys(ROUND129_LOCALE_PATCH[lang]).forEach(function(key){ DICT[lang][key] = ROUND129_LOCALE_PATCH[lang][key]; });
  });


  // Round 131: reviewed page-wide static copy translations (English-first).
  var ROUND131_PAGE_COPY = {"地址绑定 · BTCBOX":"Address Management · BTCBOX","地址绑定":"Address Management","新增地址":"Add Address","加密货币地址":"Crypto Address","银行账户":"Bank Account","币种":"Asset","网络":"Network","地址":"Address","备注":"Label","保存":"Save","已绑定地址":"Saved Addresses","加载中…":"Loading…","加载中...":"Loading…","地址一经绑定，用户不可自行修改或删除。如需更改或解绑，请联系客服处理。":"Once an address is bound, you cannot edit or remove it yourself. Contact Support to change or unlink it.","输入加密货币地址":"Enter crypto address","备注（选填）":"Label (optional)","请联系客服处理":"Contact Support","暂无绑定地址":"No saved addresses","提交成功":"Submitted successfully","操作失败":"Action failed","网络异常":"Network error","网络异常，请稍后重试":"Network error. Please try again later.","身份认证 · BTCBOX":"Identity Verification · BTCBOX","身份认证":"Identity Verification","提交身份信息，审核通过后提升提币额度":"Submit your identity details to increase withdrawal limits after approval.","去认证":"Verify Now","认证资料已锁定":"Verification details are locked","认证资料":"Verification Details","真实姓名":"Legal Name","证件类型":"Document Type","证件号码":"Document Number","提交高级认证":"Submit Advanced Verification","身份证":"National ID","护照":"Passport","驾驶证":"Driver’s License","证件正面照":"Front of Document","证件反面照":"Back of Document","提交审核":"Submit for Review","提交后审核预计 1-3 个工作日完成，审核期间可正常交易，提币额度将在认证通过后提升。":"Review usually takes 1–3 business days. You can continue trading during review; withdrawal limits increase after approval.","认证等级":"Verification Level","基础认证":"Basic Verification","邮箱验证":"Email Verification","未完成":"Incomplete","高级认证":"Advanced Verification","身份证信息提交审核":"Identity document submitted for review","机构认证":"Business Verification","企业用户专属 · 可选":"For business users · Optional","未开通":"Not enabled","额度说明":"Limits","24h 充值额度":"24-hour deposit limit","以认证等级为准":"Based on verification level","24h 提币额度":"24-hour withdrawal limit","法币交易":"Fiat trading","完成高级认证后开通":"Available after advanced verification","请输入与证件一致的姓名":"Enter your name exactly as shown on your document","请输入证件号码":"Enter your document number","登录 · BTCBOX":"Log In · BTCBOX","登录":"Log In","注册":"Sign Up","邮箱":"Email","密码":"Password","确认密码":"Confirm Password","记住我":"Remember me","忘记密码？":"Forgot password?","或":"or","使用 Google 账号继续":"Continue with Google","还没有账号？":"Don’t have an account?","立即注册":"Sign Up Now","登录即表示同意":"By logging in, you agree to the","服务条款":"Terms of Service","和":"and","隐私政策":"Privacy Policy","数字资产交易涉及风险，请谨慎投资":"Digital asset trading involves risk. Please invest responsibly.","请输入邮箱地址":"Enter your email address","请输入密码（至少6位）":"Enter your password (at least 6 characters)","显示密码":"Show password","请再次输入密码":"Re-enter your password","在线客服 · BTCBOX":"Support · BTCBOX","在线客服":"Support","BTCBOX 专属客服":"BTCBOX Customer Support","在线 · 工作时间内尽快回复":"Online · We’ll reply as soon as possible during business hours","暂无对话，发送消息开始咨询":"No messages yet. Send a message to start a conversation.","如何充值？":"How do I deposit?","提币到账时间":"Withdrawal processing time","KYC 认证":"KYC verification","忘记密码":"Forgot password","交易费率":"Trading fees","如何充值数字资产？":"How do I deposit digital assets?","提币多久能到账？":"How long do withdrawals take?","如何完成身份认证(KYC)？":"How do I complete identity verification (KYC)?","忘记密码怎么办？":"What if I forget my password?","交易费率是多少？":"What are the trading fees?","请输入您的问题":"Enter your question","请输入您的问题...":"Enter your question…","发送":"Send","提现 · BTCBOX":"Withdraw · BTCBOX","提现":"Withdraw","提现记录":"Withdrawal History","提币前请确认地址正确，链上转账不可撤销":"Verify the address before withdrawing. On-chain transfers cannot be reversed.","可用":"Available","提币网络":"Withdrawal Network","提币地址":"Withdrawal Address","手动输入新地址":"Enter a new address manually","去绑定地址":"Manage Addresses","数量":"Amount","手续费：":"Fee:","全部提现":"Withdraw All","到账数量":"Amount to Receive","预计到账时间":"Estimated Arrival","约 5-10 分钟":"About 5–10 minutes","确认提现":"Confirm Withdrawal","请输入或粘贴提币地址":"Enter or paste a withdrawal address","充值 · BTCBOX":"Deposit · BTCBOX","充值":"Deposit","请确认充值地址与网络一致，错充将无法找回":"Make sure the deposit address and network match. Incorrect deposits may be unrecoverable.","选择币种":"Select Asset","选择网络":"Select Network","USDT (TRC20) 充值地址":"USDT (TRC20) Deposit Address","复制地址":"Copy Address","温馨提示":"Important Information","· 最小充值金额：1 USDT（或等值），少于最小金额将无法到账":"· Minimum deposit: 1 USDT (or equivalent). Smaller deposits may not be credited.","· 充值确认数：20 个区块确认后到账":"· Deposits are credited after 20 block confirmations.","· 请勿充值非对应币种资产至该地址":"· Do not send assets other than the selected currency to this address.","最近充值记录":"Recent Deposits","充值二维码":"Deposit QR code","请先登录后获取充值地址":"Log in to get a deposit address","充值通道维护中，请联系在线客服获取地址":"The deposit channel is under maintenance. Contact Support for assistance.","设置 · BTCBOX":"Settings · BTCBOX","设置":"Settings","安全设置":"Security","登录密码":"Login Password","定期修改更安全":"Change it regularly for better security","资金密码":"Fund Password","提币与资金操作验证":"Required to verify withdrawals and fund operations","双重验证 (2FA)":"Two-Factor Authentication (2FA)","偏好设置":"Preferences","界面语言":"Interface Language","简体中文":"简体中文","繁體中文":"繁體中文","语言":"Language","计价货币":"Display Currency","深色/浅色模式":"Dark/Light Theme","深色模式":"Dark Mode","关于":"About","版本":"Version","理财 · BTCBOX":"Earn · BTCBOX","理财赚币":"Earn","累计收益 (USDT)":"Total Earnings (USDT)","昨日收益 --":"Yesterday’s Earnings —","理财非存款，历史年化不代表未来收益，数字资产投资有风险，申购前请仔细阅读产品说明与风险揭示书":"Earn products are not deposits. Historical annualized yields do not guarantee future returns. Digital assets involve risk. Read product details and risk disclosures before subscribing.","活期理财":"Flexible Earn","定期理财":"Fixed-Term Earn","我的持仓":"My Holdings","USDT 活期":"USDT Flexible","随存随取 · T+0 到账":"Redeem anytime · T+0 settlement","历史年化·近7日":"Historical annualized yield · 7 days","立即申购":"Subscribe","查看详情":"View Details","USDT 30天定期":"USDT 30-Day Term","锁仓30天 · 到期自动赎回":"Locked for 30 days · Auto-redeem at maturity","历史年化·参考":"Historical annualized yield · Reference","USDT 90天定期":"USDT 90-Day Term","锁仓90天 · 到期自动赎回":"Locked for 90 days · Auto-redeem at maturity","USDT 180天定期":"USDT 180-Day Term","锁仓180天 · 到期自动赎回":"Locked for 180 days · Auto-redeem at maturity","秒合约 · BTCBOX":"Short-Term Contracts · BTCBOX","秒合约":"Short-Term Contracts","K线":"Candlestick Chart","可用余额":"Available Balance","收益率":"Return Rate","30秒":"30 seconds","60秒":"60 seconds","5分钟":"5 minutes","15分钟":"15 minutes","投入金额":"Investment Amount","▲ 看涨":"▲ Up","▼ 看跌":"▼ Down","盈利 +85%":"Payout +85%","进行中":"In Progress","暂无持仓，下单后在此显示":"No positions yet. Your positions will appear here after placing an order.","最近结算":"Recent Settlements","暂无记录":"No records","BTC/USDT · K线":"BTC/USDT · Candlestick Chart","行情 · BTCBOX":"Markets · BTCBOX","行情":"Markets","搜索":"Search","涨幅榜":"Top Gainers","跌幅榜":"Top Losers","自选":"Favorites","最新价":"Last Price","24h涨跌":"24h Change","24h额":"24h Volume","搜索币种 / 交易对":"Search assets / trading pairs","资产 · BTCBOX":"Assets · BTCBOX","我的资产":"My Assets","登录态":"Signed-in account","总资产估值 (USDT)":"Total Asset Value (USDT)","今日盈亏":"Today’s P&L","订单":"Orders","币种资产":"Asset Balances","隐藏小额资产":"Hide Small Balances","游客态":"Guest view","登录后查看资产":"Log in to view your assets","安全管理您的数字资产，查看余额与盈亏":"Securely manage your digital assets and view balances and P&L","USDT Value / 24h":"USDT Value / 24h","加载资产中":"Loading assets","KYC认证":"KYC Verification","未实名认证":"Identity not verified","安全中心":"Security Center","订单与交易历史":"Orders & Trade History","充值记录":"Deposit History","退出登录":"Log Out","登录 BTCBOX":"Log in to BTCBOX","登录后享受完整交易功能，管理您的数字资产":"Log in to access trading features and manage your digital assets","交易 · BTCBOX":"Trade · BTCBOX","图表":"Chart","24h最高":"24h High","24h最低":"24h Low","买入":"Buy","卖出":"Sell","限价":"Limit","市价":"Market","价格":"Price","最大":"Max","合计":"Total","确认买入 BTC":"Confirm Buy BTC","价格(USDT)":"Price (USDT)","当前委托":"Open Orders","持仓":"Positions","历史成交":"Trade History","暂无委托，下单后在此显示":"No open orders. Place an order to see it here.","分时":"1 min","15分":"15 min","1小时":"1 hour","4小时":"4 hours","日线":"1 day","周线":"1 week","切换交易对":"Switch trading pair","关闭":"Close","订单 · BTCBOX":"Orders · BTCBOX","订单记录":"Order History","交易历史":"Trade History","暂无委托记录":"No order history","去交易":"Trade Now","我的 · BTCBOX":"My Account · BTCBOX","我的":"My Account","❌ 未实名认证":"❌ Identity not verified","总资产估值 (USDT)":"Total Asset Value (USDT)","已冻结":"Frozen","💰 我的资产":"💰 My Assets","全部资产":"All Assets","余额":"Balance","用户服务协议":"Terms of Service","风险揭示书":"Risk Disclosure","一、服务说明":"1. Service Description","BTCBOX（以下简称\"本平台\"）为用户提供数字资产行情展示、币币交易、秒合约、充值、提现、理财等相关服务。用户在使用本平台服务前，应当仔细阅读并充分理解本协议的全部内容，特别是涉及用户重大权益的条款。":"BTCBOX (the “Platform”) provides digital-asset market data, spot trading, short-term contracts, deposits, withdrawals, and earn services. Before using the Platform, users should carefully read and understand this Agreement, especially provisions that materially affect their rights.","二、账户注册与安全":"2. Account Registration and Security","用户注册时需提供真实、准确、完整的个人信息，并完成身份认证（KYC）。用户应妥善保管账户密码、资金密码与双重验证工具，不得将账户出借、转让或出售给他人。因用户自身原因导致的账户损失，由用户自行承担。":"Users must provide true, accurate, and complete personal information during registration and complete identity verification (KYC). Users must protect their account password, fund password, and two-factor authentication tools and must not lend, transfer, or sell their accounts. Users are responsible for losses caused by their own actions.","三、交易规则":"3. Trading Rules","数字资产交易存在较高市场风险，价格波动可能导致本金损失。用户应根据自身风险承受能力谨慎决策。平台有权根据市场情况调整交易规则、费率与交易对，调整前将通过公告或站内信通知用户。":"Digital-asset trading carries significant market risk, and price fluctuations may result in loss of principal. Users should make decisions according to their risk tolerance. The Platform may adjust trading rules, fees, and trading pairs based on market conditions and will notify users through announcements or in-app messages before changes take effect.","四、充值与提现":"4. Deposits and Withdrawals","用户应按照平台公示的地址与网络进行充值，错充或因网络选择错误导致的资产损失由用户自行承担。提现需完成身份认证与资金密码验证，平台有权对大额或可疑提现进行人工审核。":"Users must deposit using the address and network displayed by the Platform. Users bear losses caused by sending unsupported assets or selecting the wrong network. Withdrawals require identity verification and fund-password validation. The Platform may manually review large or suspicious withdrawals.","五、合规要求":"5. Compliance","用户须遵守所在国家或地区的法律法规，不得利用平台从事洗钱、恐怖融资、欺诈等违法活动。平台有权对可疑账户进行限制、冻结或关闭，并依法向监管机构报告。":"Users must comply with the laws of their jurisdiction and may not use the Platform for money laundering, terrorist financing, fraud, or other illegal activities. The Platform may restrict, freeze, or close suspicious accounts and report them to regulators as required by law.","六、免责声明":"6. Disclaimer","因不可抗力、系统维护、网络故障、区块链网络拥堵等原因导致的服务中断或资产延迟到账，平台不承担赔偿责任。平台保留对本协议的最终解释权与修改权，修改后将在平台公示。":"The Platform is not liable for service interruptions or delayed asset crediting caused by force majeure, maintenance, network failures, or blockchain congestion. The Platform reserves the right to interpret and amend this Agreement and will publish amendments on the Platform.","最后更新日期：2026年10月1日":"Last updated: October 1, 2026","一、信息收集":"1. Information Collection","本平台在用户注册、身份认证、交易、充值提现过程中，可能收集以下信息：电子邮箱、手机号码、身份证件信息、钱包地址、交易记录与设备日志。收集信息仅用于提供服务、风险控制与合规要求。":"When users register, verify their identity, trade, deposit, or withdraw, the Platform may collect email addresses, phone numbers, identity-document information, wallet addresses, transaction records, and device logs. This information is collected only to provide services, manage risk, and meet compliance requirements.","二、信息使用":"2. Use of Information","收集的信息将用于：账户创建与登录验证、身份认证审核、交易与资金结算、安全风控与反洗钱监测、客户服务与通知。未经用户同意，平台不会将信息用于其他商业目的。":"Collected information is used for account creation and login verification, identity checks, trading and settlement, security and anti-money-laundering monitoring, customer service, and notifications. The Platform will not use it for other commercial purposes without user consent.","三、信息存储与保护":"3. Data Storage and Protection","用户敏感信息采用加密存储与传输，访问权限严格受限。平台建立了完善的安全防护体系，但互联网环境不存在绝对安全，平台将持续升级防护措施。":"Sensitive user information is encrypted in storage and in transit, with strictly limited access. The Platform maintains security safeguards, but no internet environment is completely secure; protections will continue to be improved.","四、信息共享":"4. Information Sharing","平台不会向第三方出售用户个人信息。仅在以下情形共享：取得用户明确同意；法律法规或监管机构要求；为完成服务必需的合作方（如支付通道），且受保密协议约束。":"The Platform does not sell personal information to third parties. Information is shared only with explicit consent, when required by law or regulators, or with service providers necessary to deliver services (such as payment channels) under confidentiality obligations.","五、用户权利":"5. User Rights","用户有权查询、更正、删除个人信息，有权注销账户。注销后平台将依法删除或匿名化处理个人信息，法律法规要求保留的除外。":"Users may access, correct, and delete personal information and may close their accounts. After closure, the Platform will delete or anonymize personal information as required by law, except where retention is legally required.","六、Cookie 与同类技术":"6. Cookies and Similar Technologies","平台使用 Cookie 与本地存储记录登录状态与偏好设置，用户可通过浏览器设置清除或禁用，但可能影响部分功能使用。":"The Platform uses cookies and local storage to remember login state and preferences. Users can clear or disable them in browser settings, but some features may be affected.","一、市场风险":"1. Market Risk","数字资产价格受全球政策、市场供需、技术发展等多重因素影响，波动剧烈，可能在短时间内出现大幅涨跌。用户应充分认识到投资数字资产可能导致部分或全部本金损失。":"Digital-asset prices are affected by global policy, supply and demand, and technological developments. Prices can fluctuate sharply in a short period, and investing may result in partial or total loss of principal.","二、政策与法律风险":"2. Regulatory and Legal Risk","不同国家和地区对数字资产的监管政策存在差异且可能变化。用户应自行了解并遵守所在地法律法规，因政策变化导致的资产限制或损失由用户自行承担。":"Regulatory approaches to digital assets differ by jurisdiction and may change. Users are responsible for understanding and complying with local laws and bear losses or restrictions resulting from policy changes.","三、技术风险":"3. Technology Risk","区块链技术仍在发展中，可能遭遇硬分叉、链上拥堵、智能合约漏洞等问题。平台虽采取多重安全措施，但无法完全排除黑客攻击、系统故障等技术风险。":"Blockchain technology is still evolving and may face hard forks, network congestion, or smart-contract vulnerabilities. Although the Platform uses multiple safeguards, hacking and system failures cannot be fully ruled out.","四、流动性风险":"4. Liquidity Risk","部分小众交易对流动性不足，大额订单可能导致价格滑点，极端行情下可能无法及时成交。用户应关注交易对深度与流动性。":"Some less-traded pairs may have limited liquidity. Large orders can cause slippage, and orders may not execute promptly in extreme markets. Users should monitor order-book depth and liquidity.","五、杠杆与合约风险":"5. Leverage and Contract Risk","秒合约及杠杆类产品具有放大效应，既可能放大收益，也可能放大损失。用户应根据自身风险承受能力谨慎使用，控制仓位。":"Short-term contracts and leveraged products amplify outcomes, potentially increasing both gains and losses. Use them cautiously according to your risk tolerance and manage position sizes.","六、风险提示":"6. Risk Warning","本平台所有行情、资讯与理财收益展示均不构成投资建议。用户应独立判断、理性投资，切勿投入无法承受损失的资金。如有疑问，建议咨询独立财务顾问。":"Market data, information, and displayed earn yields on the Platform are not investment advice. Users should make independent, rational decisions and never invest funds they cannot afford to lose. Consider consulting an independent financial adviser if needed."};
  Object.assign(ROUND131_PAGE_COPY, {
    '审核中':'Under review', '尚未完成身份认证':'Identity verification is incomplete',
    '已拒绝':'Rejected', '已通过':'Approved', '提交中...':'Submitting…',
    '确认买入 ':'Confirm Buy ', '确认卖出 ':'Confirm Sell ',
    '登录后查看充值记录':'Log in to view deposit history', '暂无充值记录':'No deposit records',
    '登录后查看提现记录':'Log in to view withdrawal history', '暂无提现记录':'No withdrawal records',
    '加载失败，请刷新重试':'Could not load. Refresh and try again.',
    '登录后查看理财持仓':'Log in to view your earn holdings', '暂无持仓':'No holdings yet',
    '登录后可发送消息':'Log in to send a message', '登录后查看记录':'Log in to view records',
    '加载记录中':'Loading records…', '暂无有余额的资产':'No assets with a balance',
    '已设置，点击可修改':'Set — click to change', '未设置，提币前请先设置':'Not set. Set this before withdrawing.',
    '当前登录密码':'Current login password', '新密码（至少6位）':'New password (at least 6 characters)',
    '确认新密码':'Confirm new password', '6位数字资金密码':'6-digit fund password', '再次输入':'Enter again',
    '密钥已复制':'Secret copied', '输入6位验证码':'Enter 6-digit verification code',
    '暂无委托记录':'No order history', '登录后查看资产':'Log in to view your assets',
    '显示全部资产':'Show all assets', '隐藏小额资产':'Hide small balances',
    '请先登录后获取充值地址':'Log in to get a deposit address',
    '网络异常，请稍后重试':'Network error. Please try again later.',
    '登录后查看资产':'Log in to view your assets', '登录后查看订单':'Log in to view orders',
    '登录后可交易、充值、提现':'Log in to trade, deposit, and withdraw',
    '请输入或粘贴提币地址':'Enter or paste a withdrawal address',
    '手动输入新地址':'Enter a new address manually', '暂未绑定提现地址':'No withdrawal address is linked yet',
    '可选择已绑定地址，敏感信息已脱敏显示':'Choose a saved address. Sensitive details are masked.',
    '已绑定地址':'Saved Addresses', '暂无绑定地址':'No saved addresses',
    '暂无记录':'No records', '暂无数据':'No data available',
    '请联系客服处理':'Contact Support', '操作失败':'Action failed', '提交成功':'Submitted successfully',
    '加载中…':'Loading…', '加载中...':'Loading…', '加载中':'Loading…'
  });
  Object.keys(ROUND131_PAGE_COPY).forEach(function(source){
    var key = "r131_" + Object.keys(ROUND131_PAGE_COPY).indexOf(source);
    DICT["zh-CN"][key] = source;
    DICT["en"][key] = ROUND131_PAGE_COPY[source];
    ["zh-TW", "ja", "ko", "vi"].forEach(function(lang){ DICT[lang][key] = ROUND131_PAGE_COPY[source]; });
  });



  // Round 131: dynamic loading, empty, validation and action-state copy.
  var ROUND131_DYNAMIC_COPY = {"loadingText":"Loading…","loginToGetDepositAddress":"Log in to get a deposit address","depositChannelMaintenance":"The deposit channel is under maintenance. Contact Support for assistance.","networkTryAgain":"Network error. Please try again later.","loginToViewDeposits":"Log in to view deposit history","noDepositRecords":"No deposit records","loginToViewWithdrawals":"Log in to view withdrawal history","noWithdrawalRecords":"No withdrawal records","recordsLoadFailed":"Could not load records. Refresh and try again.","submitting":"Submitting…","confirmWithdrawal":"Confirm Withdrawal","confirmSubscription":"Subscribe Now","earnProduct":"Earn Product","loginToViewEarn":"Log in to view your earn holdings","noEarnHoldings":"No holdings yet","assetDepositNow":"No assets yet. Deposit now","showAllAssets":"Show All Assets","hideSmallAssets":"Hide Small Balances","loginToSendMessage":"Log in to send a message","noChatYet":"No messages yet. Send a message to start a conversation.","kycVerified":"Identity verified","kycReviewing":"Under review","kycNotComplete":"Identity verification is incomplete","kycApproved":"Approved","unlimited":"No limit","riskBasedLimit":"Subject to risk assessment","enabled":"Enabled","basicLimit":"Basic limit","availableAfterVerification":"Available after verification approval","improvedAfterVerification":"Increases after verification","fundPasswordSet":"Set — click to change","fundPasswordMissing":"Not set. Set this before withdrawing.","currentLoginPassword":"Current login password","newPasswordMin":"New password (at least 6 characters)","confirmNewPassword":"Confirm new password","fundPassword6":"6-digit fund password","enterAgain":"Enter again","secretCopied":"Secret copied","enter2fa":"Enter 6-digit verification code","enter2faToDisable":"Enter 6-digit code to disable","marketPrice":"Market","noData":"No data available","confirmBuy":"Confirm Buy","confirmSell":"Confirm Sell","noOrderHistory":"No order history","loginToViewRecords":"Log in to view records","loadingRecords":"Loading records…","noAssetsWithBalance":"No assets with a balance","showAssets":"Show all assets","switchNetworkSuffix":"network"};
  ROUND131_DYNAMIC_COPY.legalTitle = 'Legal Terms';
  ROUND131_DYNAMIC_COPY.amountParen = 'Amount (';
  ROUND131_DYNAMIC_COPY.tradeRecords = 'Trade History';
  DICT['zh-CN'].legalTitle = '法律条款';
  DICT['zh-CN'].amountParen = '数量(';
  DICT['zh-CN'].tradeRecords = '交易记录';
  ['zh-TW','ja','ko','vi'].forEach(function(lang){ DICT[lang].legalTitle = 'Legal Terms'; DICT[lang].amountParen = 'Amount ('; DICT[lang].tradeRecords = 'Trade History'; });
  // Round 136: provide locale-complete copy for frequently used runtime states.
  // Never use internal key names as visible Chinese text, and never silently mix English into another locale.
  var ROUND136_DYNAMIC_LOCALES = {
    'zh-CN': {legalTitle:'法律条款',amountParen:'数量(',tradeRecords:'交易记录',loadingText:'加载中…',loginToGetDepositAddress:'登录后获取充值地址',depositChannelMaintenance:'充值通道维护中，请联系客服',networkTryAgain:'网络异常，请稍后重试',loginToViewDeposits:'登录后查看充值记录',noDepositRecords:'暂无充值记录',loginToViewWithdrawals:'登录后查看提现记录',noWithdrawalRecords:'暂无提现记录',recordsLoadFailed:'记录加载失败，请刷新重试',submitting:'提交中…',confirmWithdrawal:'确认提现',confirmSubscription:'立即申购',earnProduct:'理财产品',loginToViewEarn:'登录后查看理财持仓',noEarnHoldings:'暂无持仓',assetDepositNow:'暂无资产，立即充值',showAllAssets:'显示全部资产',hideSmallAssets:'隐藏小额资产',loginToSendMessage:'登录后发送消息',noChatYet:'暂无消息，发送消息开始对话',kycVerified:'身份已认证',kycReviewing:'审核中',kycNotComplete:'身份认证尚未完成',kycApproved:'已通过',unlimited:'不限额度',riskBasedLimit:'以风险评估为准',enabled:'已启用',basicLimit:'基础额度',availableAfterVerification:'认证通过后可用',improvedAfterVerification:'认证通过后额度提高',fundPasswordSet:'已设置，点击可修改',fundPasswordMissing:'尚未设置，请先设置资金密码再提现',currentLoginPassword:'当前登录密码',newPasswordMin:'新密码（至少 6 位）',confirmNewPassword:'确认新密码',fundPassword6:'6 位资金密码',enterAgain:'再次输入',secretCopied:'密钥已复制',enter2fa:'输入 6 位验证码',enter2faToDisable:'输入 6 位验证码以关闭',marketPrice:'市价',noData:'暂无数据',confirmBuy:'确认买入',confirmSell:'确认卖出',noOrderHistory:'暂无订单历史',loginToViewRecords:'登录后查看记录',loadingRecords:'记录加载中…',noAssetsWithBalance:'没有有余额的资产',showAssets:'显示全部资产',fundPasswordPlaceholder:'资金密码（6位数字）',fundPasswordUnset:'尚未设置资金密码，请先设置后再提现',twofaRequiredPlaceholder:'2FA验证码（已启用双重验证，必填）',twofaOptionalPlaceholder:'未启用2FA，可留空',depositAddressTitle:'充值地址',withdrawHint:'请先核对地址和网络',fundPasswordPlaceholder:'資金密碼（6 位數字）',fundPasswordUnset:'尚未設定資金密碼，請先設定後再提現',twofaRequiredPlaceholder:'2FA 驗證碼（已啟用雙重驗證，必填）',twofaOptionalPlaceholder:'未啟用 2FA，可留空',depositAddressTitle:'充值地址',withdrawHint:'請先核對地址與網路',fundPasswordPlaceholder:'Fund password (6 digits)',fundPasswordUnset:'Fund password not set; set it before withdrawing',twofaRequiredPlaceholder:'2FA code (required because 2FA is enabled)',twofaOptionalPlaceholder:'2FA is not enabled; leave blank',depositAddressTitle:'Deposit address',withdrawHint:'Verify the address and network before continuing',fundPasswordPlaceholder:'資金パスワード（6桁）',fundPasswordUnset:'未設定です。出金前に設定してください',twofaRequiredPlaceholder:'2FAコード（有効のため必須）',twofaOptionalPlaceholder:'2FAは無効です。空欄にできます',depositAddressTitle:'入金アドレス',withdrawHint:'続行する前にアドレスとネットワークを確認してください',fundPasswordPlaceholder:'자금 비밀번호(6자리)',fundPasswordUnset:'설정되지 않았습니다. 출금 전에 설정하세요',twofaRequiredPlaceholder:'2FA 코드(활성화되어 필수)',twofaOptionalPlaceholder:'2FA가 비활성화되어 있습니다. 비워 둘 수 있습니다',depositAddressTitle:'입금 주소',withdrawHint:'계속하기 전에 주소와 네트워크를 확인하세요',fundPasswordPlaceholder:'Mật khẩu quỹ (6 chữ số)',fundPasswordUnset:'Chưa thiết lập; hãy đặt trước khi rút tiền',twofaRequiredPlaceholder:'Mã 2FA (bắt buộc vì đã bật 2FA)',twofaOptionalPlaceholder:'2FA chưa bật; có thể để trống',depositAddressTitle:'Địa chỉ nạp',withdrawHint:'Kiểm tra địa chỉ và mạng trước khi tiếp tục',switchNetworkSuffix:'网络'},
    'zh-TW': {legalTitle:'法律條款',amountParen:'數量(',tradeRecords:'交易紀錄',loadingText:'載入中…',loginToGetDepositAddress:'登入後取得充值地址',depositChannelMaintenance:'充值通道維護中，請聯絡客服',networkTryAgain:'網路異常，請稍後重試',loginToViewDeposits:'登入後查看充值紀錄',noDepositRecords:'暫無充值紀錄',loginToViewWithdrawals:'登入後查看提現紀錄',noWithdrawalRecords:'暫無提現紀錄',recordsLoadFailed:'紀錄載入失敗，請重新整理',submitting:'提交中…',confirmWithdrawal:'確認提現',confirmSubscription:'立即申購',earnProduct:'理財產品',loginToViewEarn:'登入後查看理財持倉',noEarnHoldings:'暫無持倉',assetDepositNow:'暫無資產，立即充值',showAllAssets:'顯示全部資產',hideSmallAssets:'隱藏小額資產',loginToSendMessage:'登入後傳送訊息',noChatYet:'暫無訊息，傳送訊息開始對話',kycVerified:'身分已驗證',kycReviewing:'審核中',kycNotComplete:'身分驗證尚未完成',kycApproved:'已通過',unlimited:'不限額度',riskBasedLimit:'依風險評估為準',enabled:'已啟用',basicLimit:'基本額度',availableAfterVerification:'驗證通過後可用',improvedAfterVerification:'驗證通過後額度提高',fundPasswordSet:'已設定，點擊可修改',fundPasswordMissing:'尚未設定，請先設定資金密碼再提現',currentLoginPassword:'目前登入密碼',newPasswordMin:'新密碼（至少 6 位）',confirmNewPassword:'確認新密碼',fundPassword6:'6 位資金密碼',enterAgain:'再次輸入',secretCopied:'密鑰已複製',enter2fa:'輸入 6 位驗證碼',enter2faToDisable:'輸入 6 位驗證碼以關閉',marketPrice:'市價',noData:'暫無資料',confirmBuy:'確認買入',confirmSell:'確認賣出',noOrderHistory:'暫無訂單紀錄',loginToViewRecords:'登入後查看紀錄',loadingRecords:'紀錄載入中…',noAssetsWithBalance:'沒有可用餘額的資產',showAssets:'顯示全部資產',switchNetworkSuffix:'網路'},
    'en': ROUND131_DYNAMIC_COPY,
    'ja': {legalTitle:'法的事項',amountParen:'数量(',tradeRecords:'取引履歴',loadingText:'読み込み中…',loginToGetDepositAddress:'ログインして入金アドレスを取得',depositChannelMaintenance:'入金チャネルはメンテナンス中です。サポートにお問い合わせください',networkTryAgain:'ネットワークエラーです。しばらくしてから再試行してください',loginToViewDeposits:'ログインして入金履歴を表示',noDepositRecords:'入金履歴はありません',loginToViewWithdrawals:'ログインして出金履歴を表示',noWithdrawalRecords:'出金履歴はありません',recordsLoadFailed:'履歴を読み込めません。更新して再試行してください',submitting:'送信中…',confirmWithdrawal:'出金を確認',confirmSubscription:'申し込む',earnProduct:'運用商品',loginToViewEarn:'ログインして運用保有資産を表示',noEarnHoldings:'保有資産はありません',assetDepositNow:'資産がありません。入金してください',showAllAssets:'すべての資産を表示',hideSmallAssets:'少額資産を非表示',loginToSendMessage:'ログインしてメッセージを送信',noChatYet:'メッセージはありません。送信して会話を開始してください',kycVerified:'本人確認済み',kycReviewing:'審査中',kycNotComplete:'本人確認が未完了です',kycApproved:'承認済み',unlimited:'上限なし',riskBasedLimit:'リスク評価によります',enabled:'有効',basicLimit:'基本上限',availableAfterVerification:'本人確認承認後に利用可能',improvedAfterVerification:'本人確認後に上限が引き上げられます',fundPasswordSet:'設定済み（クリックして変更）',fundPasswordMissing:'未設定です。出金前に設定してください',currentLoginPassword:'現在のログインパスワード',newPasswordMin:'新しいパスワード（6文字以上）',confirmNewPassword:'新しいパスワードを確認',fundPassword6:'6桁の資金パスワード',enterAgain:'もう一度入力',secretCopied:'シークレットをコピーしました',enter2fa:'6桁の認証コードを入力',enter2faToDisable:'無効化するには6桁のコードを入力',marketPrice:'成行',noData:'データがありません',confirmBuy:'購入を確認',confirmSell:'売却を確認',noOrderHistory:'注文履歴はありません',loginToViewRecords:'ログインして履歴を表示',loadingRecords:'履歴を読み込み中…',noAssetsWithBalance:'残高のある資産はありません',showAssets:'すべての資産を表示',switchNetworkSuffix:'ネットワーク'},
    'ko': {legalTitle:'법률 약관',amountParen:'수량(',tradeRecords:'거래 내역',loadingText:'불러오는 중…',loginToGetDepositAddress:'로그인하여 입금 주소 받기',depositChannelMaintenance:'입금 채널 점검 중입니다. 고객지원에 문의하세요',networkTryAgain:'네트워크 오류입니다. 잠시 후 다시 시도하세요',loginToViewDeposits:'로그인하여 입금 내역 보기',noDepositRecords:'입금 내역이 없습니다',loginToViewWithdrawals:'로그인하여 출금 내역 보기',noWithdrawalRecords:'출금 내역이 없습니다',recordsLoadFailed:'내역을 불러오지 못했습니다. 새로고침 후 다시 시도하세요',submitting:'제출 중…',confirmWithdrawal:'출금 확인',confirmSubscription:'지금 가입',earnProduct:'예치 상품',loginToViewEarn:'로그인하여 예치 보유 내역 보기',noEarnHoldings:'보유 내역이 없습니다',assetDepositNow:'자산이 없습니다. 지금 입금하세요',showAllAssets:'모든 자산 보기',hideSmallAssets:'소액 자산 숨기기',loginToSendMessage:'로그인하여 메시지 보내기',noChatYet:'메시지가 없습니다. 메시지를 보내 대화를 시작하세요',kycVerified:'본인 인증 완료',kycReviewing:'검토 중',kycNotComplete:'본인 인증이 완료되지 않았습니다',kycApproved:'승인됨',unlimited:'제한 없음',riskBasedLimit:'위험 평가에 따름',enabled:'활성화됨',basicLimit:'기본 한도',availableAfterVerification:'인증 승인 후 이용 가능',improvedAfterVerification:'인증 후 한도가 증가합니다',fundPasswordSet:'설정됨 — 클릭하여 변경',fundPasswordMissing:'미설정입니다. 출금 전에 설정하세요',currentLoginPassword:'현재 로그인 비밀번호',newPasswordMin:'새 비밀번호(6자 이상)',confirmNewPassword:'새 비밀번호 확인',fundPassword6:'6자리 자금 비밀번호',enterAgain:'다시 입력',secretCopied:'보안 키가 복사되었습니다',enter2fa:'6자리 인증 코드 입력',enter2faToDisable:'비활성화하려면 6자리 코드 입력',marketPrice:'시장가',noData:'데이터 없음',confirmBuy:'매수 확인',confirmSell:'매도 확인',noOrderHistory:'주문 내역 없음',loginToViewRecords:'로그인하여 내역 보기',loadingRecords:'내역 불러오는 중…',noAssetsWithBalance:'잔액이 있는 자산이 없습니다',showAssets:'모든 자산 보기',switchNetworkSuffix:'네트워크'},
    'vi': {legalTitle:'Điều khoản pháp lý',amountParen:'Số lượng (',tradeRecords:'Lịch sử giao dịch',loadingText:'Đang tải…',loginToGetDepositAddress:'Đăng nhập để lấy địa chỉ nạp',depositChannelMaintenance:'Kênh nạp đang bảo trì. Vui lòng liên hệ hỗ trợ',networkTryAgain:'Lỗi mạng. Vui lòng thử lại sau',loginToViewDeposits:'Đăng nhập để xem lịch sử nạp',noDepositRecords:'Chưa có lịch sử nạp',loginToViewWithdrawals:'Đăng nhập để xem lịch sử rút',noWithdrawalRecords:'Chưa có lịch sử rút',recordsLoadFailed:'Không thể tải lịch sử. Hãy làm mới và thử lại',submitting:'Đang gửi…',confirmWithdrawal:'Xác nhận rút',confirmSubscription:'Đăng ký ngay',earnProduct:'Sản phẩm sinh lời',loginToViewEarn:'Đăng nhập để xem tài sản sinh lời',noEarnHoldings:'Chưa có tài sản nắm giữ',assetDepositNow:'Chưa có tài sản. Nạp ngay',showAllAssets:'Hiển thị tất cả tài sản',hideSmallAssets:'Ẩn số dư nhỏ',loginToSendMessage:'Đăng nhập để gửi tin nhắn',noChatYet:'Chưa có tin nhắn. Gửi tin nhắn để bắt đầu trò chuyện',kycVerified:'Đã xác minh danh tính',kycReviewing:'Đang xét duyệt',kycNotComplete:'Chưa hoàn tất xác minh danh tính',kycApproved:'Đã phê duyệt',unlimited:'Không giới hạn',riskBasedLimit:'Tùy theo đánh giá rủi ro',enabled:'Đã bật',basicLimit:'Hạn mức cơ bản',availableAfterVerification:'Có thể dùng sau khi xác minh được duyệt',improvedAfterVerification:'Hạn mức tăng sau khi xác minh',fundPasswordSet:'Đã thiết lập — nhấn để thay đổi',fundPasswordMissing:'Chưa thiết lập. Hãy đặt trước khi rút tiền',currentLoginPassword:'Mật khẩu đăng nhập hiện tại',newPasswordMin:'Mật khẩu mới (ít nhất 6 ký tự)',confirmNewPassword:'Xác nhận mật khẩu mới',fundPassword6:'Mật khẩu quỹ 6 chữ số',enterAgain:'Nhập lại',secretCopied:'Đã sao chép mã bí mật',enter2fa:'Nhập mã xác minh 6 chữ số',enter2faToDisable:'Nhập mã 6 chữ số để tắt',marketPrice:'Thị trường',noData:'Không có dữ liệu',confirmBuy:'Xác nhận mua',confirmSell:'Xác nhận bán',noOrderHistory:'Chưa có lịch sử lệnh',loginToViewRecords:'Đăng nhập để xem lịch sử',loadingRecords:'Đang tải lịch sử…',noAssetsWithBalance:'Không có tài sản có số dư',showAssets:'Hiển thị tất cả tài sản',switchNetworkSuffix:'mạng'}
  };
  Object.keys(ROUND131_DYNAMIC_COPY).forEach(function(key){
    Object.keys(ROUND136_DYNAMIC_LOCALES).forEach(function(lang){
      if(ROUND136_DYNAMIC_LOCALES[lang][key]) DICT[lang][key] = ROUND136_DYNAMIC_LOCALES[lang][key];
    });
  });


  // Round 137: page-level dynamic states and modal copy for trading, funding, Earn and KYC.
  var ROUND137_COPY = {
    'zh-CN': {loginViewDepositHistory:'登录后查看充值记录',depositConfirmed:'已到账',depositConfirming:'审核中',noDepositHistory:'暂无充值记录',loginViewWithdrawHistory:'登录后查看提现记录',noWithdrawHistory:'暂无提现记录',withdrawConfirmDetails:'请核对以下提币信息，确认无误后提交。',withdrawCoin:'提币币种',withdrawAddress:'提币地址',withdrawAmount:'提币数量',networkFee:'网络手续费',actualReceived:'实际到账',withdrawIrreversible:'链上转账不可撤销，请务必确认地址与网络正确。若地址错误，资产将无法找回。',confirmWithdrawTitle:'确认提币',confirmSubmit:'确认提交',checkAgain:'再检查一下',manualNewAddress:'手动输入新地址',boundAddressHint:'可选择已绑定地址，敏感信息已脱敏显示',noBoundAddress:'暂未绑定提现地址',newAddressPlaceholder:'请输入或粘贴提币地址',selectWithdrawCoin:'选择提币币种',loginViewOrders:'登录后查看记录',orderAmount:'金额',orderTime:'时间',txHash:'交易哈希',noOrders:'暂无订单记录',noTradeHistory:'暂无交易历史',buy:'买入',sell:'卖出',orderPending:'处理中',orderOpen:'未成交',orderFilled:'已成交',orderCanceled:'已取消',orderRejected:'已拒绝',orderClosed:'已平仓',orderSettled:'已结算',loginViewKyc:'登录后查看认证状态',kycGuestSub:'完成身份认证可提升充值与提币额度，保障账户安全',goLogin:'去登录',kycLocked:'认证资料已锁定',kycReviewPending:'审核中，请耐心等待',kycNotSubmitted:'身份证信息提交审核 · 未提交',kycLevel1Done:'邮箱验证 · 已完成',kycSubmit:'提交审核',kycNoRecords:'暂无委托，下单后在此显示',kycCompleteFiat:'完成高级认证后开通',earnProductInfo:'产品说明',earnHistoricalApy:'历史年化',earnMinimum:'起购金额',earnPayout:'收益发放',earnRedemption:'赎回到账',earnMinDetail:'10 USDT（或等值）',earnPayoutDetail:'每日结算 / 到期一次性发放',earnRedemptionDetail:'T+0 / 到期自动赎回',earnRisk:'历史年化仅供参考，不构成收益承诺。数字资产价格波动可能导致本金损失，平台不承担保本义务。',acknowledge:'我知道了',loginViewEarnHoldings:'登录后查看理财持仓',noEarnHoldingsEmpty:'暂无理财持仓，去申购吧',earnRedeem:'赎回',earnMaturity:'到期',earnExpectedReturn:'预期收益',earnApy:'年化',earnLoadFailed:'加载失败，请刷新重试',marketOrdersUnavailable:'当前暂不支持市价单，请使用限价单。',orderOutcomeUnknown:'订单结果暂未确认。请先刷新订单记录，确认结果后再提交新订单。',orderEngineUnavailable:'撮合服务暂不可用，本次未创建订单。请稍后重试。',orderAmountInvalid:'请输入大于零的有效数量。',orderPriceInvalid:'请输入大于零的有效限价。',tradeBuyConfirm:'确认买入',tradeSellConfirm:'确认卖出',tradeNoOpenOrders:'暂无委托，下单后在此显示',tradeNoPositions:'暂无持仓',tradeNoHistory:'暂无历史成交',tradeFloating:'浮动',tradeOrderPending:'委托中'},
    'zh-TW': {loginViewDepositHistory:'登入後查看充值紀錄',depositConfirmed:'已到帳',depositConfirming:'審核中',noDepositHistory:'暫無充值紀錄',loginViewWithdrawHistory:'登入後查看提現紀錄',noWithdrawHistory:'暫無提現紀錄',withdrawConfirmDetails:'請核對以下提現資訊，確認無誤後提交。',withdrawCoin:'提現幣種',withdrawAddress:'提現地址',withdrawAmount:'提現數量',networkFee:'網路手續費',actualReceived:'實際到帳',withdrawIrreversible:'鏈上轉帳不可撤銷，請確認地址與網路正確。若地址錯誤，資產將無法找回。',confirmWithdrawTitle:'確認提現',confirmSubmit:'確認提交',checkAgain:'再次檢查',manualNewAddress:'手動輸入新地址',boundAddressHint:'可選擇已綁定地址，敏感資訊已遮蔽',noBoundAddress:'尚未綁定提現地址',newAddressPlaceholder:'請輸入或貼上提現地址',selectWithdrawCoin:'選擇提現幣種',loginViewOrders:'登入後查看紀錄',orderAmount:'金額',orderTime:'時間',txHash:'交易雜湊',noOrders:'暫無訂單紀錄',noTradeHistory:'暫無交易歷史',buy:'買入',sell:'賣出',orderPending:'處理中',orderOpen:'未成交',orderFilled:'已成交',orderCanceled:'已取消',orderRejected:'已拒絕',orderClosed:'已平倉',orderSettled:'已結算',loginViewKyc:'登入後查看驗證狀態',kycGuestSub:'完成身分驗證可提高充值與提現額度，保障帳戶安全',goLogin:'登入',kycLocked:'驗證資料已鎖定',kycReviewPending:'審核中，請耐心等待',kycNotSubmitted:'身分證資訊待提交審核',kycLevel1Done:'電子郵件驗證 · 已完成',kycSubmit:'提交審核',kycNoRecords:'暫無委託，下單後將顯示於此',kycCompleteFiat:'完成進階驗證後開通',earnProductInfo:'產品說明',earnHistoricalApy:'歷史年化',earnMinimum:'最低申購金額',earnPayout:'收益發放',earnRedemption:'贖回到帳',earnMinDetail:'10 USDT（或等值）',earnPayoutDetail:'每日結算／到期一次性發放',earnRedemptionDetail:'T+0／到期自動贖回',earnRisk:'歷史年化僅供參考，不構成收益承諾。數位資產價格波動可能導致本金損失，平台不承擔保本義務。',acknowledge:'我知道了',loginViewEarnHoldings:'登入後查看理財持倉',noEarnHoldingsEmpty:'暫無理財持倉，立即申購',earnRedeem:'贖回',earnMaturity:'到期',earnExpectedReturn:'預期收益',earnApy:'年化',earnLoadFailed:'載入失敗，請重新整理',marketOrdersUnavailable:'目前暫不支援市價單，請使用限價單。',orderOutcomeUnknown:'訂單結果尚未確認。請先重新整理訂單紀錄，確認結果後再提交新訂單。',orderEngineUnavailable:'撮合服務暫不可用，本次未建立訂單。請稍後重試。',orderAmountInvalid:'請輸入大於零的有效數量。',orderPriceInvalid:'請輸入大於零的有效限價。',tradeBuyConfirm:'確認買入',tradeSellConfirm:'確認賣出',tradeNoOpenOrders:'暫無委託，下單後將顯示於此',tradeNoPositions:'暫無持倉',tradeNoHistory:'暫無成交紀錄',tradeFloating:'浮動',tradeOrderPending:'委託中'},
    'en': {loginViewDepositHistory:'Log in to view deposit history',depositConfirmed:'Credited',depositConfirming:'Under review',noDepositHistory:'No deposit history',loginViewWithdrawHistory:'Log in to view withdrawal history',noWithdrawHistory:'No withdrawal history',withdrawConfirmDetails:'Review the withdrawal details below before submitting.',withdrawCoin:'Asset',withdrawAddress:'Withdrawal address',withdrawAmount:'Withdrawal amount',networkFee:'Network fee',actualReceived:'Amount to receive',withdrawIrreversible:'Blockchain transfers cannot be reversed. Verify the address and network carefully. Assets sent to an incorrect address may be unrecoverable.',confirmWithdrawTitle:'Confirm withdrawal',confirmSubmit:'Submit',checkAgain:'Review again',manualNewAddress:'Enter a new address manually',boundAddressHint:'Select a saved address. Sensitive details are masked.',noBoundAddress:'No saved withdrawal address',newAddressPlaceholder:'Enter or paste the withdrawal address',selectWithdrawCoin:'Select asset',loginViewOrders:'Log in to view records',orderAmount:'Amount',orderTime:'Time',txHash:'Transaction hash',noOrders:'No order records',noTradeHistory:'No trade history',buy:'Buy',sell:'Sell',orderPending:'Processing',orderOpen:'Open',orderFilled:'Filled',orderCanceled:'Canceled',orderRejected:'Rejected',orderClosed:'Closed',orderSettled:'Settled',loginViewKyc:'Log in to view verification status',kycGuestSub:'Verify your identity to increase deposit and withdrawal limits and help protect your account.',goLogin:'Log in',kycLocked:'Verification details are locked',kycReviewPending:'Under review. Please wait.',kycNotSubmitted:'Identity document not submitted',kycLevel1Done:'Email verification · Complete',kycSubmit:'Submit for review',kycNoRecords:'No open orders yet. Place an order to see it here.',kycCompleteFiat:'Available after advanced verification',earnProductInfo:'Product details',earnHistoricalApy:'Historical APY',earnMinimum:'Minimum subscription',earnPayout:'Earnings payout',earnRedemption:'Redemption settlement',earnMinDetail:'10 USDT or equivalent',earnPayoutDetail:'Daily settlement or one-time payout at maturity',earnRedemptionDetail:'T+0 or automatic redemption at maturity',earnRisk:'Historical APY is for reference only and is not a guarantee. Digital asset prices may fluctuate and you may lose principal. The platform does not guarantee your principal.',acknowledge:'Got it',loginViewEarnHoldings:'Log in to view Earn holdings',noEarnHoldingsEmpty:'No Earn holdings yet. Subscribe to a product.',earnRedeem:'Redeem',earnMaturity:'Maturity',earnExpectedReturn:'Expected return',earnApy:'APY',earnLoadFailed:'Could not load data. Refresh and try again.',marketOrdersUnavailable:'Market orders are not currently supported. Please use a limit order.',orderOutcomeUnknown:'The order outcome is not confirmed. Refresh your order history and verify the result before submitting another order.',orderEngineUnavailable:'The matching service is unavailable. No order was created; please try again later.',orderAmountInvalid:'Enter a valid quantity greater than zero.',orderPriceInvalid:'Enter a valid limit price greater than zero.',tradeBuyConfirm:'Confirm Buy',tradeSellConfirm:'Confirm Sell',tradeNoOpenOrders:'No open orders. Place an order to see it here.',tradeNoPositions:'No positions',tradeNoHistory:'No trade history',tradeFloating:'Unrealized P&L',tradeOrderPending:'Pending'},
    'ja': {loginViewDepositHistory:'ログインして入金履歴を表示',depositConfirmed:'入金済み',depositConfirming:'審査中',noDepositHistory:'入金履歴はありません',loginViewWithdrawHistory:'ログインして出金履歴を表示',noWithdrawHistory:'出金履歴はありません',withdrawConfirmDetails:'以下の出金内容を確認してから送信してください。',withdrawCoin:'資産',withdrawAddress:'出金アドレス',withdrawAmount:'出金額',networkFee:'ネットワーク手数料',actualReceived:'受取額',withdrawIrreversible:'ブロックチェーン送金は取り消せません。アドレスとネットワークを確認してください。誤送金した資産は回復できない場合があります。',confirmWithdrawTitle:'出金を確認',confirmSubmit:'送信',checkAgain:'再確認',manualNewAddress:'新しいアドレスを手入力',boundAddressHint:'保存済みアドレスを選択できます。機密情報はマスクされます。',noBoundAddress:'保存済みの出金アドレスはありません',newAddressPlaceholder:'出金アドレスを入力または貼り付け',selectWithdrawCoin:'資産を選択',loginViewOrders:'ログインして履歴を表示',orderAmount:'金額',orderTime:'時間',txHash:'トランザクションハッシュ',noOrders:'注文履歴はありません',noTradeHistory:'取引履歴はありません',buy:'買い',sell:'売り',orderPending:'処理中',orderOpen:'未約定',orderFilled:'約定済み',orderCanceled:'キャンセル済み',orderRejected:'拒否',orderClosed:'決済済み',orderSettled:'精算済み',loginViewKyc:'ログインして本人確認状況を表示',kycGuestSub:'本人確認により入出金限度額を引き上げ、アカウントの安全性を高めます。',goLogin:'ログイン',kycLocked:'本人確認情報はロックされています',kycReviewPending:'審査中です。しばらくお待ちください。',kycNotSubmitted:'本人確認書類は未提出です',kycLevel1Done:'メール認証 · 完了',kycSubmit:'審査に提出',kycNoRecords:'注文はありません。注文するとここに表示されます。',kycCompleteFiat:'上級本人確認後に利用可能',earnProductInfo:'商品詳細',earnHistoricalApy:'過去の年利',earnMinimum:'最低申込額',earnPayout:'収益支払い',earnRedemption:'償還受取',earnMinDetail:'10 USDT相当',earnPayoutDetail:'毎日精算、または満期時に一括支払い',earnRedemptionDetail:'T+0 または満期時に自動償還',earnRisk:'過去の年利は参考値であり、収益を保証しません。暗号資産の価格変動により元本を失う可能性があります。',acknowledge:'了解',loginViewEarnHoldings:'ログインして運用保有資産を表示',noEarnHoldingsEmpty:'保有資産はありません。商品をお申し込みください。',earnRedeem:'償還',earnMaturity:'満期',earnExpectedReturn:'予想収益',earnApy:'年利',earnLoadFailed:'読み込めません。更新して再試行してください。',marketOrdersUnavailable:'現在、成行注文には対応していません。指値注文をご利用ください。',orderOutcomeUnknown:'注文結果を確認できません。注文履歴を更新して結果を確認してから、新しい注文を送信してください。',orderEngineUnavailable:'マッチングサービスを利用できません。注文は作成されていません。後でもう一度お試しください。',orderAmountInvalid:'0より大きい有効な数量を入力してください。',orderPriceInvalid:'0より大きい有効な指値価格を入力してください。',tradeBuyConfirm:'購入を確認',tradeSellConfirm:'売却を確認',tradeNoOpenOrders:'注文はありません。注文するとここに表示されます。',tradeNoPositions:'ポジションはありません',tradeNoHistory:'取引履歴はありません',tradeFloating:'含み損益',tradeOrderPending:'注文中'},
    'ko': {loginViewDepositHistory:'로그인하여 입금 내역 보기',depositConfirmed:'입금 완료',depositConfirming:'검토 중',noDepositHistory:'입금 내역이 없습니다',loginViewWithdrawHistory:'로그인하여 출금 내역 보기',noWithdrawHistory:'출금 내역이 없습니다',withdrawConfirmDetails:'아래 출금 정보를 확인한 후 제출하세요.',withdrawCoin:'자산',withdrawAddress:'출금 주소',withdrawAmount:'출금 금액',networkFee:'네트워크 수수료',actualReceived:'실수령액',withdrawIrreversible:'블록체인 전송은 취소할 수 없습니다. 주소와 네트워크를 확인하세요. 잘못 보낸 자산은 복구할 수 없을 수 있습니다.',confirmWithdrawTitle:'출금 확인',confirmSubmit:'제출',checkAgain:'다시 확인',manualNewAddress:'새 주소 직접 입력',boundAddressHint:'저장된 주소를 선택할 수 있습니다. 민감한 정보는 마스킹됩니다.',noBoundAddress:'저장된 출금 주소가 없습니다',newAddressPlaceholder:'출금 주소를 입력하거나 붙여넣으세요',selectWithdrawCoin:'자산 선택',loginViewOrders:'로그인하여 내역 보기',orderAmount:'금액',orderTime:'시간',txHash:'거래 해시',noOrders:'주문 내역이 없습니다',noTradeHistory:'거래 내역이 없습니다',buy:'매수',sell:'매도',orderPending:'처리 중',orderOpen:'미체결',orderFilled:'체결 완료',orderCanceled:'취소됨',orderRejected:'거부됨',orderClosed:'종료됨',orderSettled:'정산 완료',loginViewKyc:'로그인하여 인증 상태 보기',kycGuestSub:'본인 인증을 완료하면 입출금 한도가 높아지고 계정 보안이 강화됩니다.',goLogin:'로그인',kycLocked:'인증 정보가 잠겨 있습니다',kycReviewPending:'심사 중입니다. 잠시 기다려 주세요.',kycNotSubmitted:'신분증이 제출되지 않았습니다',kycLevel1Done:'이메일 인증 · 완료',kycSubmit:'심사 제출',kycNoRecords:'주문이 없습니다. 주문하면 여기에 표시됩니다.',kycCompleteFiat:'고급 인증 후 이용 가능',earnProductInfo:'상품 정보',earnHistoricalApy:'과거 연이율',earnMinimum:'최소 가입 금액',earnPayout:'수익 지급',earnRedemption:'환급 정산',earnMinDetail:'10 USDT 또는 이에 상응하는 금액',earnPayoutDetail:'매일 정산 또는 만기 시 일괄 지급',earnRedemptionDetail:'T+0 또는 만기 시 자동 환급',earnRisk:'과거 연이율은 참고용이며 수익을 보장하지 않습니다. 디지털 자산 가격 변동으로 원금 손실이 발생할 수 있습니다.',acknowledge:'확인',loginViewEarnHoldings:'로그인하여 예치 보유 내역 보기',noEarnHoldingsEmpty:'보유 내역이 없습니다. 상품에 가입하세요.',earnRedeem:'환급',earnMaturity:'만기',earnExpectedReturn:'예상 수익',earnApy:'연이율',earnLoadFailed:'불러오지 못했습니다. 새로고침 후 다시 시도하세요.',marketOrdersUnavailable:'현재 시장가 주문은 지원되지 않습니다. 지정가 주문을 이용하세요.',orderOutcomeUnknown:'주문 결과가 확인되지 않았습니다. 주문 내역을 새로고침해 결과를 확인한 후 새 주문을 제출하세요.',orderEngineUnavailable:'매칭 서비스를 사용할 수 없습니다. 주문이 생성되지 않았습니다. 나중에 다시 시도하세요.',orderAmountInvalid:'0보다 큰 유효한 수량을 입력하세요.',orderPriceInvalid:'0보다 큰 유효한 지정가를 입력하세요.',tradeBuyConfirm:'매수 확인',tradeSellConfirm:'매도 확인',tradeNoOpenOrders:'주문이 없습니다. 주문하면 여기에 표시됩니다.',tradeNoPositions:'포지션이 없습니다',tradeNoHistory:'거래 내역이 없습니다',tradeFloating:'미실현 손익',tradeOrderPending:'주문 중'},
    'vi': {loginViewDepositHistory:'Đăng nhập để xem lịch sử nạp',depositConfirmed:'Đã ghi có',depositConfirming:'Đang xét duyệt',noDepositHistory:'Không có lịch sử nạp',loginViewWithdrawHistory:'Đăng nhập để xem lịch sử rút',noWithdrawHistory:'Không có lịch sử rút',withdrawConfirmDetails:'Vui lòng kiểm tra thông tin rút tiền bên dưới trước khi gửi.',withdrawCoin:'Tài sản',withdrawAddress:'Địa chỉ rút',withdrawAmount:'Số tiền rút',networkFee:'Phí mạng',actualReceived:'Số tiền nhận',withdrawIrreversible:'Giao dịch blockchain không thể đảo ngược. Hãy kiểm tra kỹ địa chỉ và mạng. Tài sản gửi sai địa chỉ có thể không khôi phục được.',confirmWithdrawTitle:'Xác nhận rút tiền',confirmSubmit:'Gửi',checkAgain:'Kiểm tra lại',manualNewAddress:'Nhập địa chỉ mới thủ công',boundAddressHint:'Chọn địa chỉ đã lưu. Thông tin nhạy cảm được che.',noBoundAddress:'Chưa có địa chỉ rút đã lưu',newAddressPlaceholder:'Nhập hoặc dán địa chỉ rút tiền',selectWithdrawCoin:'Chọn tài sản',loginViewOrders:'Đăng nhập để xem lịch sử',orderAmount:'Số tiền',orderTime:'Thời gian',txHash:'Mã giao dịch',noOrders:'Không có lịch sử lệnh',noTradeHistory:'Không có lịch sử giao dịch',buy:'Mua',sell:'Bán',orderPending:'Đang xử lý',orderOpen:'Đang mở',orderFilled:'Đã khớp',orderCanceled:'Đã hủy',orderRejected:'Bị từ chối',orderClosed:'Đã đóng',orderSettled:'Đã quyết toán',loginViewKyc:'Đăng nhập để xem trạng thái xác minh',kycGuestSub:'Xác minh danh tính để tăng hạn mức nạp và rút, đồng thời bảo vệ tài khoản.',goLogin:'Đăng nhập',kycLocked:'Thông tin xác minh đã bị khóa',kycReviewPending:'Đang xét duyệt. Vui lòng chờ.',kycNotSubmitted:'Chưa gửi giấy tờ tùy thân',kycLevel1Done:'Xác minh email · Hoàn tất',kycSubmit:'Gửi xét duyệt',kycNoRecords:'Chưa có lệnh mở. Đặt lệnh để xem tại đây.',kycCompleteFiat:'Khả dụng sau khi xác minh nâng cao',earnProductInfo:'Chi tiết sản phẩm',earnHistoricalApy:'APY lịch sử',earnMinimum:'Số tiền đăng ký tối thiểu',earnPayout:'Chi trả lợi nhuận',earnRedemption:'Thanh toán hoàn đổi',earnMinDetail:'10 USDT hoặc tương đương',earnPayoutDetail:'Quyết toán hằng ngày hoặc trả một lần khi đáo hạn',earnRedemptionDetail:'T+0 hoặc tự động hoàn đổi khi đáo hạn',earnRisk:'APY lịch sử chỉ mang tính tham khảo và không đảm bảo lợi nhuận. Giá tài sản số biến động có thể gây mất vốn.',acknowledge:'Đã hiểu',loginViewEarnHoldings:'Đăng nhập để xem tài sản sinh lời',noEarnHoldingsEmpty:'Chưa có tài sản sinh lời. Hãy đăng ký sản phẩm.',earnRedeem:'Hoàn đổi',earnMaturity:'Đáo hạn',earnExpectedReturn:'Lợi nhuận dự kiến',earnApy:'APY',earnLoadFailed:'Không thể tải dữ liệu. Hãy làm mới và thử lại.',marketOrdersUnavailable:'Hiện chưa hỗ trợ lệnh thị trường. Vui lòng sử dụng lệnh giới hạn.',orderOutcomeUnknown:'Chưa xác nhận được kết quả lệnh. Hãy làm mới lịch sử lệnh và kiểm tra kết quả trước khi gửi lệnh mới.',orderEngineUnavailable:'Dịch vụ khớp lệnh hiện không khả dụng. Lệnh chưa được tạo; vui lòng thử lại sau.',orderAmountInvalid:'Nhập khối lượng hợp lệ lớn hơn 0.',orderPriceInvalid:'Nhập giá giới hạn hợp lệ lớn hơn 0.',tradeBuyConfirm:'Xác nhận mua',tradeSellConfirm:'Xác nhận bán',tradeNoOpenOrders:'Chưa có lệnh mở. Đặt lệnh để xem tại đây.',tradeNoPositions:'Không có vị thế',tradeNoHistory:'Không có lịch sử giao dịch',tradeFloating:'Lãi/lỗ chưa thực hiện',tradeOrderPending:'Đang chờ'}
  };
  Object.keys(ROUND137_COPY).forEach(function(lang){ Object.keys(ROUND137_COPY[lang]).forEach(function(key){ DICT[lang][key] = ROUND137_COPY[lang][key]; }); });

  var ROUND137_SECURITY_PLACEHOLDERS = {
    'zh-CN': {fundPasswordPlaceholder:'资金密码（6位数字）',fundPasswordUnset:'尚未设置资金密码，请先设置后再提现',twofaRequiredPlaceholder:'双重验证已启用，必须填写验证码',twofaOptionalPlaceholder:'未启用双重验证，可留空',depositAddressTitle:'充值地址',withdrawHint:'请先核对地址和网络'},
    'zh-TW': {fundPasswordPlaceholder:'資金密碼（6 位數字）',fundPasswordUnset:'尚未設定資金密碼，請先設定後再提現',twofaRequiredPlaceholder:'已啟用雙重驗證，必須填寫驗證碼',twofaOptionalPlaceholder:'未啟用雙重驗證，可留空',depositAddressTitle:'充值地址',withdrawHint:'請先核對地址與網路'},
    'en': {fundPasswordPlaceholder:'Fund password (6 digits)',fundPasswordUnset:'Fund password not set; set it before withdrawing',twofaRequiredPlaceholder:'2FA code (required because 2FA is enabled)',twofaOptionalPlaceholder:'2FA is not enabled; leave blank',depositAddressTitle:'Deposit address',withdrawHint:'Verify the address and network before continuing'},
    'ja': {fundPasswordPlaceholder:'資金パスワード（6桁）',fundPasswordUnset:'未設定です。出金前に設定してください',twofaRequiredPlaceholder:'2FAコード（有効のため必須）',twofaOptionalPlaceholder:'2FAは無効です。空欄にできます',depositAddressTitle:'入金アドレス',withdrawHint:'続行する前にアドレスとネットワークを確認してください'},
    'ko': {fundPasswordPlaceholder:'자금 비밀번호(6자리)',fundPasswordUnset:'설정되지 않았습니다. 출금 전에 설정하세요',twofaRequiredPlaceholder:'2FA 코드(활성화되어 필수)',twofaOptionalPlaceholder:'2FA가 비활성화되어 있습니다. 비워 둘 수 있습니다',depositAddressTitle:'입금 주소',withdrawHint:'계속하기 전에 주소와 네트워크를 확인하세요'},
    'vi': {fundPasswordPlaceholder:'Mật khẩu quỹ (6 chữ số)',fundPasswordUnset:'Chưa thiết lập; hãy đặt trước khi rút tiền',twofaRequiredPlaceholder:'Mã 2FA (bắt buộc vì đã bật 2FA)',twofaOptionalPlaceholder:'2FA chưa bật; có thể để trống',depositAddressTitle:'Địa chỉ nạp',withdrawHint:'Kiểm tra địa chỉ và mạng trước khi tiếp tục'}
  };
  Object.keys(ROUND137_SECURITY_PLACEHOLDERS).forEach(function(lang){ Object.keys(ROUND137_SECURITY_PLACEHOLDERS[lang]).forEach(function(key){ DICT[lang][key] = ROUND137_SECURITY_PLACEHOLDERS[lang][key]; }); });


  // Round 138: eliminate remaining hardcoded runtime copy in trade, withdrawal and earn flows.
  var ROUND138_COPY = {
    'zh-CN': {cancelAction:'取消',earnSubscribeTitle:'申购确认',earnSubscribeBody:'您即将申购',earnAmountPlaceholder:'申购金额（USDT）',confirmSubscribeAction:'确认申购',subscribeNow:'立即申购'},
    'zh-TW': {cancelAction:'取消',earnSubscribeTitle:'申購確認',earnSubscribeBody:'您即將申購',earnAmountPlaceholder:'申購金額（USDT）',confirmSubscribeAction:'確認申購',subscribeNow:'立即申購'},
    'en': {cancelAction:'Cancel',earnSubscribeTitle:'Confirm subscription',earnSubscribeBody:'You are about to subscribe to',earnAmountPlaceholder:'Subscription amount (USDT)',confirmSubscribeAction:'Confirm subscription',subscribeNow:'Subscribe now'},
    'ja': {cancelAction:'キャンセル',earnSubscribeTitle:'申込確認',earnSubscribeBody:'次の商品に申し込みます：',earnAmountPlaceholder:'申込金額（USDT）',confirmSubscribeAction:'申し込む',subscribeNow:'今すぐ申し込む'},
    'ko': {cancelAction:'취소',earnSubscribeTitle:'가입 확인',earnSubscribeBody:'다음 상품에 가입합니다:',earnAmountPlaceholder:'가입 금액 (USDT)',confirmSubscribeAction:'가입 확인',subscribeNow:'지금 가입'},
    'vi': {cancelAction:'Hủy',earnSubscribeTitle:'Xác nhận đăng ký',earnSubscribeBody:'Bạn sắp đăng ký sản phẩm',earnAmountPlaceholder:'Số tiền đăng ký (USDT)',confirmSubscribeAction:'Xác nhận đăng ký',subscribeNow:'Đăng ký ngay'}
  };
  Object.keys(ROUND138_COPY).forEach(function(lang){ Object.keys(ROUND138_COPY[lang]).forEach(function(key){ DICT[lang][key] = ROUND138_COPY[lang][key]; }); });

  // Round 139: localized status and failure copy for transaction-critical pages.
  var ROUND139_COPY = {
    'zh-CN': {feeLabel:'手续费',addressLabel:'地址：',rejectReasonLabel:'拒绝原因：',withdrawProcessing:'处理中',recordsLoadFailed:'加载失败，请刷新重试',networkError:'网络异常',loginAction:'去登录',floatingPnl:'浮动',orderStatusUnknown:'状态未知',kycTypeIdCard:'身份证',kycTypePassport:'护照',kycTypeDriver:'驾驶证',kycLocked:'认证资料已锁定',kycSubmit:'提交审核',kycCompleteFiat:'完成高级认证后可用'},
    'zh-TW': {feeLabel:'手續費',addressLabel:'地址：',rejectReasonLabel:'拒絕原因：',withdrawProcessing:'處理中',recordsLoadFailed:'載入失敗，請重新整理後重試',networkError:'網路異常',loginAction:'前往登入',floatingPnl:'浮動',orderStatusUnknown:'狀態未知',kycTypeIdCard:'身分證',kycTypePassport:'護照',kycTypeDriver:'駕照',kycLocked:'認證資料已鎖定',kycSubmit:'提交審核',kycCompleteFiat:'完成進階認證後可用'},
    'en': {feeLabel:'Fee:',addressLabel:'Address:',rejectReasonLabel:'Rejection reason:',withdrawProcessing:'Processing',recordsLoadFailed:'Could not load records. Refresh and try again.',networkError:'Network error. Please try again.',loginAction:'Log In',floatingPnl:'Unrealized P&L',orderStatusUnknown:'Status unknown',kycTypeIdCard:'National ID',kycTypePassport:'Passport',kycTypeDriver:'Driver license',kycLocked:'Verification details are locked',kycSubmit:'Submit for review',kycCompleteFiat:'Available after advanced verification'},
    'ja': {feeLabel:'手数料：',addressLabel:'アドレス：',rejectReasonLabel:'却下理由：',withdrawProcessing:'処理中',recordsLoadFailed:'記録を読み込めません。更新して再試行してください。',networkError:'ネットワークエラー。再試行してください。',loginAction:'ログイン',floatingPnl:'未実現損益',orderStatusUnknown:'状態不明',kycTypeIdCard:'身分証明書',kycTypePassport:'パスポート',kycTypeDriver:'運転免許証',kycLocked:'本人確認情報はロックされています',kycSubmit:'審査に提出',kycCompleteFiat:'本人確認完了後に利用可能'},
    'ko': {feeLabel:'수수료:',addressLabel:'주소:',rejectReasonLabel:'거절 사유:',withdrawProcessing:'처리 중',recordsLoadFailed:'기록을 불러오지 못했습니다. 새로고침 후 다시 시도하세요.',networkError:'네트워크 오류입니다. 다시 시도해 주세요.',loginAction:'로그인',floatingPnl:'미실현 손익',orderStatusUnknown:'상태 알 수 없음',kycTypeIdCard:'신분증',kycTypePassport:'여권',kycTypeDriver:'운전면허증',kycLocked:'인증 정보가 잠겨 있습니다',kycSubmit:'심사 제출',kycCompleteFiat:'고급 인증 후 이용 가능'},
    'vi': {feeLabel:'Phí:',addressLabel:'Địa chỉ:',rejectReasonLabel:'Lý do từ chối:',withdrawProcessing:'Đang xử lý',recordsLoadFailed:'Không thể tải lịch sử. Hãy làm mới và thử lại.',networkError:'Lỗi mạng. Vui lòng thử lại.',loginAction:'Đăng nhập',floatingPnl:'Lãi/lỗ chưa thực hiện',orderStatusUnknown:'Chưa xác định trạng thái',kycTypeIdCard:'Giấy tờ tùy thân',kycTypePassport:'Hộ chiếu',kycTypeDriver:'Bằng lái xe',kycLocked:'Thông tin xác minh đã bị khóa',kycSubmit:'Gửi xét duyệt',kycCompleteFiat:'Khả dụng sau khi xác minh nâng cao'}
  };
  Object.keys(ROUND139_COPY).forEach(function(lang){ Object.keys(ROUND139_COPY[lang]).forEach(function(key){ DICT[lang][key] = ROUND139_COPY[lang][key]; }); });

  // Round 135: localized copy for dynamically created security/support/address UI.
  var ROUND135_COPY = {
    enable2faTitle: ['启用双重验证 (2FA)', 'Enable two-factor authentication (2FA)'],
    twofaInstruction: ['请使用 Google Authenticator 扫描二维码或手动输入密钥', 'Scan the QR code with Google Authenticator or enter the secret manually.'],
    qrLoading: ['二维码加载中...', 'Loading QR code…'],
    copySecret: ['复制', 'Copy'],
    secretCopied: ['密钥已复制', 'Secret copied'],
    confirmEnable: ['确认启用', 'Enable'],
    changeLoginPassword: ['修改登录密码', 'Change login password'],
    submitSuccess: ['提交成功', 'Submitted successfully'],
    twofaEnabled: ['双重验证已启用', 'Two-factor authentication enabled'],
    passwordChanged: ['密码修改成功，请重新登录', 'Password changed. Please sign in again.'],
    fundPasswordCreated: ['资金密码设置成功', 'Fund password set successfully'],
    twofaDisabled: ['双重验证已关闭', 'Two-factor authentication disabled'],
    confirmChange: ['确认修改', 'Confirm changes'],
    setFundPasswordTitle: ['设置资金密码', 'Set fund password'],
    fundPasswordPurpose: ['资金密码用于提现等敏感操作，须为 6 位数字', 'Your 6-digit fund password is required for sensitive actions such as withdrawals.'],
    confirmSet: ['确认设置', 'Set password'],
    disable2faTitle: ['关闭双重验证', 'Disable two-factor authentication'],
    disable2faWarning: ['关闭后账户安全性降低，确定要关闭吗？关闭需输入当前 6 位验证码。', 'Disabling two-factor authentication reduces account security. Enter your current 6-digit code to continue.'],
    confirmDisable: ['确认关闭', 'Disable'],
    supportAgentAvatar: ['客', 'Support'],
    supportUserAvatar: ['我', 'You'],
    noChatYet: ['暂无对话，发送消息开始咨询', 'No messages yet. Send a message to start a conversation.'],
    loginToContactSupport: ['请先登录后联系在线客服', 'Log in to contact Support'],
    goLogin: ['去登录', 'Log in'],
    accountHolder: ['账户持有人姓名', 'Account holder name'],
    bankName: ['银行名称', 'Bank name'],
    accountNumber: ['账号', 'Account number'],
    routingNumber: ['Routing Number / ABA', 'Routing number / ABA'],
    swiftBic: ['SWIFT / BIC', 'SWIFT / BIC'],
    bankAddress: ['银行地址', 'Bank address'],
    addressNetworkError: ['网络异常', 'Network error. Please try again.'],
    addressOperationFailed: ['操作失败', 'Operation failed. Please try again.'],
    contactSupportForChanges: ['如需更改或解绑，请联系客服处理', 'Contact Support to change or unlink a saved address.']
  };
  Object.keys(ROUND135_COPY).forEach(function(key){
    DICT['zh-CN'][key] = ROUND135_COPY[key][0];
    DICT['en'][key] = ROUND135_COPY[key][1];
  });
  var ROUND136_SECURITY_LOCALES = {
    'zh-TW': {enable2faTitle:'啟用雙重驗證 (2FA)',twofaInstruction:'請使用 Google Authenticator 掃描 QR 碼或手動輸入密鑰。',qrLoading:'QR 碼載入中…',copySecret:'複製',secretCopied:'密鑰已複製',confirmEnable:'確認啟用',changeLoginPassword:'修改登入密碼',submitSuccess:'提交成功',twofaEnabled:'已啟用雙重驗證',passwordChanged:'密碼已修改，請重新登入。',fundPasswordCreated:'資金密碼設定成功',twofaDisabled:'已關閉雙重驗證',confirmChange:'確認修改',setFundPasswordTitle:'設定資金密碼',fundPasswordPurpose:'資金密碼用於提現等敏感操作，必須為 6 位數字。',confirmSet:'確認設定',disable2faTitle:'關閉雙重驗證',disable2faWarning:'關閉後帳戶安全性會降低。請輸入目前的 6 位驗證碼以繼續。',confirmDisable:'確認關閉',supportAgentAvatar:'客服',supportUserAvatar:'我',noChatYet:'暫無對話，傳送訊息開始諮詢',loginToContactSupport:'請先登入再聯絡線上客服',goLogin:'前往登入',accountHolder:'帳戶持有人姓名',bankName:'銀行名稱',accountNumber:'帳號',routingNumber:'路由號碼 / ABA',swiftBic:'SWIFT / BIC',bankAddress:'銀行地址',addressNetworkError:'網路異常，請重試',addressOperationFailed:'操作失敗，請重試',contactSupportForChanges:'如需更改或解除綁定，請聯絡客服'},
    'ja': {enable2faTitle:'二要素認証を有効にする (2FA)',twofaInstruction:'Google Authenticator で QR コードをスキャンするか、シークレットを手動で入力してください。',qrLoading:'QR コードを読み込み中…',copySecret:'コピー',secretCopied:'シークレットをコピーしました',confirmEnable:'有効にする',changeLoginPassword:'ログインパスワードを変更',submitSuccess:'送信しました',twofaEnabled:'二要素認証を有効にしました',passwordChanged:'パスワードを変更しました。再度ログインしてください。',fundPasswordCreated:'資金パスワードを設定しました',twofaDisabled:'二要素認証を無効にしました',confirmChange:'変更を確認',setFundPasswordTitle:'資金パスワードを設定',fundPasswordPurpose:'出金などの重要な操作には 6 桁の資金パスワードが必要です。',confirmSet:'設定する',disable2faTitle:'二要素認証を無効にする',disable2faWarning:'無効にするとアカウントの安全性が低下します。現在の 6 桁コードを入力してください。',confirmDisable:'無効にする',supportAgentAvatar:'サポート',supportUserAvatar:'ユーザー',noChatYet:'メッセージはありません。メッセージを送信してお問い合わせください',loginToContactSupport:'ログインしてサポートにお問い合わせください',goLogin:'ログイン',accountHolder:'口座名義人',bankName:'銀行名',accountNumber:'口座番号',routingNumber:'ルーティング番号 / ABA',swiftBic:'SWIFT / BIC',bankAddress:'銀行住所',addressNetworkError:'ネットワークエラーです。再試行してください',addressOperationFailed:'操作に失敗しました。再試行してください',contactSupportForChanges:'変更または解除はサポートにお問い合わせください'},
    'ko': {enable2faTitle:'2단계 인증(2FA) 활성화',twofaInstruction:'Google Authenticator로 QR 코드를 스캔하거나 비밀 키를 직접 입력하세요.',qrLoading:'QR 코드 불러오는 중…',copySecret:'복사',secretCopied:'비밀 키를 복사했습니다',confirmEnable:'활성화',changeLoginPassword:'로그인 비밀번호 변경',submitSuccess:'제출 완료',twofaEnabled:'2단계 인증이 활성화되었습니다',passwordChanged:'비밀번호가 변경되었습니다. 다시 로그인하세요.',fundPasswordCreated:'자금 비밀번호가 설정되었습니다',twofaDisabled:'2단계 인증이 비활성화되었습니다',confirmChange:'변경 확인',setFundPasswordTitle:'자금 비밀번호 설정',fundPasswordPurpose:'출금 등 민감한 작업에는 6자리 자금 비밀번호가 필요합니다.',confirmSet:'설정',disable2faTitle:'2단계 인증 비활성화',disable2faWarning:'비활성화하면 계정 보안이 낮아집니다. 현재 6자리 코드를 입력하세요.',confirmDisable:'비활성화',supportAgentAvatar:'지원',supportUserAvatar:'사용자',noChatYet:'메시지가 없습니다. 메시지를 보내 문의를 시작하세요',loginToContactSupport:'로그인하여 고객지원에 문의하세요',goLogin:'로그인',accountHolder:'예금주 이름',bankName:'은행명',accountNumber:'계좌번호',routingNumber:'라우팅 번호 / ABA',swiftBic:'SWIFT / BIC',bankAddress:'은행 주소',addressNetworkError:'네트워크 오류입니다. 다시 시도하세요',addressOperationFailed:'작업에 실패했습니다. 다시 시도하세요',contactSupportForChanges:'변경 또는 연결 해제는 고객지원에 문의하세요'},
    'vi': {enable2faTitle:'Bật xác thực hai yếu tố (2FA)',twofaInstruction:'Quét mã QR bằng Google Authenticator hoặc nhập khóa bí mật thủ công.',qrLoading:'Đang tải mã QR…',copySecret:'Sao chép',secretCopied:'Đã sao chép mã bí mật',confirmEnable:'Bật',changeLoginPassword:'Đổi mật khẩu đăng nhập',submitSuccess:'Gửi thành công',twofaEnabled:'Đã bật xác thực hai yếu tố',passwordChanged:'Đã đổi mật khẩu. Vui lòng đăng nhập lại.',fundPasswordCreated:'Đã đặt mật khẩu quỹ',twofaDisabled:'Đã tắt xác thực hai yếu tố',confirmChange:'Xác nhận thay đổi',setFundPasswordTitle:'Đặt mật khẩu quỹ',fundPasswordPurpose:'Cần mật khẩu quỹ gồm 6 chữ số cho các thao tác nhạy cảm như rút tiền.',confirmSet:'Đặt mật khẩu',disable2faTitle:'Tắt xác thực hai yếu tố',disable2faWarning:'Tắt tính năng này sẽ giảm bảo mật tài khoản. Nhập mã 6 chữ số hiện tại để tiếp tục.',confirmDisable:'Tắt',supportAgentAvatar:'Hỗ trợ',supportUserAvatar:'Bạn',noChatYet:'Chưa có tin nhắn. Gửi tin nhắn để bắt đầu trò chuyện với bộ phận hỗ trợ',loginToContactSupport:'Đăng nhập để liên hệ hỗ trợ trực tuyến',goLogin:'Đăng nhập',accountHolder:'Tên chủ tài khoản',bankName:'Tên ngân hàng',accountNumber:'Số tài khoản',routingNumber:'Mã định tuyến / ABA',swiftBic:'SWIFT / BIC',bankAddress:'Địa chỉ ngân hàng',addressNetworkError:'Lỗi mạng. Vui lòng thử lại',addressOperationFailed:'Thao tác thất bại. Vui lòng thử lại',contactSupportForChanges:'Liên hệ hỗ trợ để thay đổi hoặc hủy liên kết địa chỉ đã lưu'}
  };
  Object.keys(ROUND135_COPY).forEach(function(key){
    Object.keys(ROUND136_SECURITY_LOCALES).forEach(function(lang){
      if(ROUND136_SECURITY_LOCALES[lang][key]) DICT[lang][key] = ROUND136_SECURITY_LOCALES[lang][key];
    });
  });
  ['zh-CN','zh-TW','en','ja','ko','vi'].forEach(function(lang){
    DICT[lang].themeLight = ({'zh-CN':'浅色模式','zh-TW':'淺色模式','en':'Light mode','ja':'ライトモード','ko':'라이트 모드','vi':'Chế độ sáng'})[lang];
    DICT[lang].themeDark = ({'zh-CN':'深色模式','zh-TW':'深色模式','en':'Dark mode','ja':'ダークモード','ko':'다크 모드','vi':'Chế độ tối'})[lang];
  });

  ['zh-CN','zh-TW','en','ja','ko','vi'].forEach(function(lang){
    if(!DICT[lang]) return;
    if(lang === 'zh-CN') DICT[lang].noSavedAddresses = '暂无绑定地址';
    else DICT[lang].noSavedAddresses = 'No saved addresses';
  });

  Object.keys(PATCH).forEach(function(lang){
    if(DICT[lang]){ Object.keys(PATCH[lang]).forEach(function(k){ if(!DICT[lang][k]) DICT[lang][k] = PATCH[lang][k]; }); }
  });

  // Round 132: normalize server-returned messages before displaying them.
  // API responses historically contain Simplified Chinese; never leak that text
  // into an English / Traditional Chinese / Japanese / Korean / Vietnamese UI.
  var ROUND132_API_MESSAGE_COPY = {
    '请求内容格式无效':'Invalid request format.',
    '请求内容过大':'Request is too large.',
    '请求内容不是有效的 JSON':'Request is not valid JSON.',
    '请求内容必须是 JSON 对象':'Request must be a JSON object.',
    '网络异常':'Network error. Please try again.',
    '请求过于频繁，请稍后再试':'Too many requests. Please try again later.',
    '邮箱格式不正确':'Invalid email address.',
    '邮箱格式无效':'Invalid email address.',
    '该邮箱已注册':'This email is already registered.',
    '该邮箱已被其他账户使用':'This email is already in use by another account.',
    '密码至少6位':'Password must be at least 6 characters.',
    '密码长度需为6至256位':'Password must be 6–256 characters long.',
    '新密码至少6位':'New password must be at least 6 characters.',
    '账号或密码错误':'Incorrect email or password.',
    '2FA验证码错误':'Incorrect two-factor authentication code.',
    '验证码错误':'Incorrect verification code.',
    '账户已被冻结，请联系客服':'Your account is frozen. Contact Support.',
    '账户已被冻结，暂不能交易':'Your account is frozen and trading is unavailable.',
    '账户已被冻结，暂不能操作理财资金':'Your account is frozen and Earn operations are unavailable.',
    '账户已被冻结，暂不能申请提现':'Your account is frozen and withdrawals are unavailable.',
    'Supabase 登录服务尚未完成服务器配置':'The sign-in service is not fully configured. Contact Support.',
    '登录令牌无效，请重新登录':'Your session is invalid. Please sign in again.',
    '登录令牌验证失败，请重试':'Could not verify your session. Please try again.',
    '登录验证服务暂不可用':'Sign-in verification is temporarily unavailable.',
    '邮箱尚未验证，无法登录':'Verify your email address before signing in.',
    '此账号已启用双重验证，请使用原有登录流程完成二次验证':'Two-factor authentication is enabled. Use the existing sign-in flow to complete verification.',
    '会话已过期，请重新登录':'Your session has expired. Please sign in again.',
    '未登录':'Please sign in to continue.',
    '用户不存在':'User account not found.',
    'K线数据不可用':'Candlestick data is unavailable.',
    '盘口数据不可用':'Order book data is unavailable.',
    '行情源不可用':'Market data source is unavailable.',
    '订单数据暂不可用，请稍后重试。':'Order data is temporarily unavailable. Please try again later.',
    '财务数据暂时不可用，请稍后重试':'Financial data is temporarily unavailable. Please try again later.',
    '财务账户暂时不可用，请稍后重试':'Financial account is temporarily unavailable. Please try again later.',
    '服务器暂时不可用，请稍后重试':'The service is temporarily unavailable. Please try again later.',
    '操作失败':'Action failed. Please try again.',
    '提交成功':'Submitted successfully.',
    '请联系客服处理':'Contact Support for assistance.',
    '地址记录不存在':'Saved address not found.',
    '操作失败：币种与网络不匹配':'The selected asset does not match the network.',
    '操作失败：地址格式无效':'Invalid address format.',
    '操作失败：请检查银行账户资料':'Check the bank account details and try again.',
    '操作失败：币种不支持':'This asset is not supported.',
    '操作失败：币种暂不支持提现':'Withdrawals are not supported for this asset.',
    '操作失败：数量无效':'Invalid amount.',
    '操作失败：该地址不可用':'This address is unavailable.',
    '请输入提币地址':'Enter a withdrawal address.',
    '请输入消息内容':'Enter a message.',
    '请先在安全中心设置资金密码':'Set a fund password in Security before continuing.',
    '资金密码为6位数字':'The fund password must contain 6 digits.',
    '资金密码错误':'Incorrect fund password.',
    '请输入6位资金密码':'Enter your 6-digit fund password.',
    '资金密码错误或尚未设置，请先在安全中心设置资金密码':'Incorrect fund password, or none is set. Set one in Security before withdrawing.',
    '此账号已启用双重验证，请输入验证码':'This account has 2FA enabled. Enter the verification code.',
    '资金密码设置成功':'Fund password set successfully.',
    '原密码错误':'Current password is incorrect.',
    '密码修改成功':'Password changed successfully.',
    '密码已重置，用户需要重新登录':'Password reset. The user must sign in again.',
    '2FA已启用':'Two-factor authentication enabled.',
    '2FA已关闭':'Two-factor authentication disabled.',
    '配置已更新':'Settings updated.',
    '回复已发送':'Reply sent.',
    '消息内容不能为空且不能超过2000字':'Message is required and must not exceed 2,000 characters.',
    '消息内容不能超过2000个字符':'Message must not exceed 2,000 characters.',
    '消息已推送':'Message sent.',
    '已通过认证，无需重复提交':'Verification is already approved. No resubmission is needed.',
    '认证审核中，请勿重复提交':'Verification is under review. Do not submit again.',
    '认证资料已提交，预计1-3个工作日完成审核':'Verification submitted. Review usually takes 1–3 business days.',
    'KYC已通过':'KYC approved.',
    'KYC已拒绝':'KYC rejected.',
    '理财产品暂不支持':'This Earn product is currently unavailable.',
    '理财服务尚未完成安全切换，资金未变更。':'Earn service security migration is incomplete. No funds were changed.',
    '当前仅支持限价单':'Only limit orders are currently supported.',
    '币种不支持':'Asset not supported.',
    '金额无效':'Invalid amount.',
    '金额格式无效':'Invalid amount format.',
    '充值金额无效，必须为大于 0 的有效数字':'Deposit amount must be a valid number greater than zero.',
    '充值地址配置格式无效':'Deposit address configuration is invalid.',
    '网络异常：充值地址尚未配置':'Network error: deposit address is not configured.',
    '充值通道维护中，请联系在线客服获取地址':'Deposit service is under maintenance. Contact Support for assistance.',
    '提现申请已提交，审核通过后到账':'Withdrawal request submitted. Funds will be credited after approval.',
    '请先在安全中心启用双重验证后再提现。':'Enable two-factor authentication in Security before withdrawing.',
    '该提现申请已接收，请勿重复提交':'Withdrawal request received. Do not submit it again.',
    '提现记录已处理，不能重复操作':'This withdrawal has already been processed.',
    '提现记录不存在':'Withdrawal record not found.',
    '财务账本尚未完成安全切换；提现未提交，余额未变更。':'The financial ledger cutover is not complete. The withdrawal was not submitted and no balance was changed.',
    '财务账本尚未完成安全切换；余额未变更。':'The financial ledger cutover is not complete. No balance was changed.',
    '财务账本尚未完成安全切换；提现未审核，资金未变更。':'The financial ledger cutover is not complete. The withdrawal was not reviewed and no funds were changed.',
    '财务账本尚未完成安全切换；提现未拒绝或退款，资金未变更。':'The financial ledger cutover is not complete. The withdrawal was not rejected or refunded and no funds were changed.',
    '资金操作类型无效':'Invalid financial operation type.',
    '操作数量无效；冻结或解冻数量必须为正数':'Invalid amount. Freeze and unfreeze amounts must be positive.',
    '可用余额不足（含手续费）':'Insufficient available balance, including fees.',
    '余额不足，不能扣减超过可用余额的数量':'Insufficient available balance.',
    '账户余额数据异常，请联系客服处理':'Account balance data is inconsistent. Contact Support.',
    '财务数据库暂不可用；入账结果未确认，请检查操作记录。':'Financial database unavailable. Deposit credit is unconfirmed; check the operation record before retrying.',
    '财务数据库暂不可用；提现未确认，请检查操作记录后再重试。':'Financial database unavailable. Withdrawal status is unconfirmed; check the operation record before retrying.',
    '数据库余额调整未确认；请检查财务操作记录后再重试，禁止直接重复操作。':'Balance adjustment is unconfirmed. Check the financial operation record before retrying; do not repeat the operation directly.',
    '数据库未确认人工入账；请检查财务操作记录后再重试，禁止直接重复操作。':'Manual deposit credit is unconfirmed. Check the financial operation record before retrying; do not repeat the operation directly.',
    '管理员认证失败':'Administrator authentication failed.',
    '管理员审计身份未配置；余额未变更。':'Administrator audit identity is not configured. No balance was changed.',
    '管理员审计身份未配置；提现未审核。':'Administrator audit identity is not configured. Withdrawal was not approved.',
    '管理员审计身份未配置；提现未拒绝或退款。':'Administrator audit identity is not configured. Withdrawal was not rejected or refunded.',
    '缺少有效的操作编号；余额未变更。':'A valid operation ID is required. No balance was changed.',
    '数据刚刚发生变化，请刷新后重试':'Data has changed. Refresh and try again.',
    '请求标识无效，请刷新后重试':'Invalid request ID. Refresh and try again.',
    '请求标识已用于其他提现内容，请刷新后重试':'This request ID was used for a different withdrawal. Refresh and try again.',
    "操作失败：充值到账须由链上确认流程完成":"Deposit credit must be completed through on-chain confirmation." ,
    "财务数据库未配置；提现未提交。":"Financial database is not configured. Withdrawal was not submitted." ,
    "操作失败：交易对暂不支持":"This trading pair is not supported." ,
    "操作失败：交易方向无效":"Invalid trade side." ,
    "操作失败：限价无效":"Invalid limit price." ,
    "请提供有效的 client_order_id（16-100位）":"Provide a valid client_order_id (16–100 characters)." ,
    "撮合引擎尚未完成数据库切换审批，本次未创建订单且未变更余额。":"The matching engine has not passed database cutover approval. No order was created and no balance was changed." ,
    "订单编号无效":"Invalid order ID." ,
    "请提供有效的 client_cancel_id（16-100位）":"Provide a valid client_cancel_id (16–100 characters)." ,
    "撮合引擎尚未完成数据库切换审批，未执行撤单。":"The matching engine has not passed database cutover approval. The order was not cancelled." ,
    "缺少有效的申购请求编号。":"A valid subscription request ID is required." ,
    "数据库未确认理财申购；请检查操作记录后再重试。":"Earn subscription is unconfirmed by the database. Check the operation record before retrying." ,
    "财务数据库暂不可用；申购结果未确认，请检查操作记录。":"Financial database is unavailable. Earn subscription status is unconfirmed; check the operation record." ,
    "记录编号无效":"Invalid record ID." ,
    "缺少有效的赎回请求编号。":"A valid redemption request ID is required." ,
    "数据库未确认理财赎回；请检查操作记录后再重试。":"Earn redemption is unconfirmed by the database. Check the operation record before retrying." ,
    "财务数据库暂不可用；赎回结果未确认，请检查操作记录。":"Financial database is unavailable. Earn redemption status is unconfirmed; check the operation record." ,
    "未知操作":"Unknown operation." ,
    "撮合订单查询尚未完成数据库切换审批。":"Matching-engine order queries have not passed database cutover approval." ,
    "财务数据库未配置；余额未变更。":"Financial database is not configured. No balance was changed." ,
    "操作失败：调整数量无效":"Invalid adjustment amount." ,
    "请填写至少 5 个字符的调整原因；余额未变更。":"Enter an adjustment reason of at least 5 characters. No balance was changed." ,
    "财务数据库暂不可用；未回退到旧余额系统，请检查操作记录。":"Financial database is unavailable. The legacy balance system was not used as a fallback; check the operation record." ,
    "余额已调整":"Balance adjusted." ,
    "邮箱已修改":"Email address updated." ,
    "财务账本尚未完成安全切换；未执行人工入账。":"The financial ledger has not completed its security cutover. Manual credit was not performed." ,
    "入账请求编号无效，请重新操作":"Invalid credit request ID. Please try again." ,
    "管理员审计身份未配置；未执行人工入账。":"Administrator audit identity is not configured. Manual credit was not performed." ,
    "提现记录编号无效":"Invalid withdrawal record ID." ,
    "财务数据库未配置；提现未审核。":"Financial database is not configured. Withdrawal was not reviewed." ,
    "数据库未确认提现审核；请检查操作记录。":"Withdrawal review is unconfirmed by the database. Check the operation record." ,
    "提现已被处理，当前操作未重复执行。":"This withdrawal has already been processed. The operation was not repeated." ,
    "财务数据库暂不可用；请检查操作记录。":"Financial database is unavailable. Check the operation record." ,
    "提现记录编号重复，已停止处理":"Duplicate withdrawal record ID. Processing was stopped." ,
    "账户冻结余额、手续费或提现记录异常，未执行审核":"Frozen balance, fee, or withdrawal record is inconsistent. Review was not performed." ,
    "提现已审核通过，冻结金额已扣除":"Withdrawal approved. The frozen amount has been deducted." ,
    "财务数据库未配置；提现未拒绝或退款。":"Financial database is not configured. Withdrawal was not rejected or refunded." ,
    "数据库未确认提现拒绝；请检查操作记录。":"Withdrawal rejection is unconfirmed by the database. Check the operation record." ,
    "提现已被处理，当前操作未重复退款。":"This withdrawal has already been processed. No duplicate refund was issued." ,
    "账户冻结余额、手续费或提现记录异常，未执行退款":"Frozen balance, fee, or withdrawal record is inconsistent. Refund was not performed." ,
    "提现已拒绝，冻结本金及手续费已退回可用余额":"Withdrawal rejected. The frozen principal and fee were returned to the available balance." ,
    "请填写拒绝原因":"Enter a reason for rejection." ,
    "存在不支持的充值网络配置":"An unsupported deposit network is configured." ,
    "公告不能超过2000个字符":"Announcement must not exceed 2,000 characters." ,
    "未知管理接口: ":"Unknown admin endpoint: " ,
    "接口不存在: ":"Endpoint not found: " ,
    "账户已被冻结，暂不能交易秒合约":"Account is frozen. Seconds contracts are not available." ,
    "秒合约尚未完成资金安全切换，本次未冻结资金、未创建持仓。":"Seconds-contract fund security migration is incomplete. No funds were frozen and no position was created." ,
    "交易对暂不支持秒合约":"This trading pair does not support seconds contracts." ,
    "合约时长无效":"Invalid contract duration." ,
    "投入金额无效":"Invalid investment amount." ,
    "缺少有效的请求编号（16-100位）。":"A valid request ID (16–100 characters) is required." ,
    "当前参考价格暂不可用，未创建订单。":"Reference price is currently unavailable. No order was created." ,
    "数据库未确认秒合约开仓；资金未变更，请检查后重试。":"Seconds-contract opening is unconfirmed by the database. No funds were changed; check before retrying." ,
    "财务数据库暂不可用；开仓结果未确认，资金未变更。":"Financial database is unavailable. Opening status is unconfirmed; no funds were changed." ,
    "秒合约尚未完成资金安全切换，本次未结算。":"Seconds-contract fund security migration is incomplete. No settlement was performed." ,
    "持仓编号无效":"Invalid position ID." ,
    "数据库未确认秒合约结算；请稍后重试。":"Seconds-contract settlement is unconfirmed by the database. Please retry later." ,
    "财务数据库暂不可用；结算结果未确认。":"Financial database is unavailable. Settlement status is unconfirmed." ,
    "秒合约尚未完成资金安全切换，暂无持仓数据。":"Seconds-contract fund security migration is incomplete. No position data is available." ,
    "秒合约持仓查询失败。":"Failed to query seconds-contract positions." ,
    "财务数据库暂不可用。":"Financial database is unavailable.",
    "交易对无效":"Invalid trading pair.",
    "结算参考价格暂不可用；订单保持未结算，请稍后重试。":"Settlement reference price is temporarily unavailable. The contract remains unsettled; please retry later.",
    "数据库未确认秒合约开仓；资金未变更，请检查后重试。":"The database did not confirm the contract opening. No balance change was made; please check before retrying.",
    "财务数据库暂不可用；开仓结果未确认，资金未变更。":"The financial database is temporarily unavailable. The opening result is unconfirmed and no balance change was made.",
    "数据库未确认秒合约结算；请稍后重试。":"The database did not confirm settlement. Please retry later.",
    "财务数据库暂不可用；结算结果未确认。":"The financial database is temporarily unavailable. The settlement result is unconfirmed.",
    "秒合约尚未完成资金安全切换，本次未冻结资金、未创建持仓。":"Seconds contracts are not enabled until the financial migration is approved. No funds were frozen and no position was created.",
    "秒合约尚未完成资金安全切换，本次未结算。":"Seconds contracts are not enabled until the financial migration is approved. No settlement was performed."
  };
  var ROUND132_UNKNOWN_SERVER_MESSAGE = 'The request could not be completed. Please try again or contact Support.';
  function translateMessage(message){
    if(message === null || message === undefined) return '';
    var source = String(message);
    if(currentLang === 'zh-CN' || !/[\u3400-\u9fff]/.test(source)) return source;
    if(Object.prototype.hasOwnProperty.call(ROUND132_API_MESSAGE_COPY, source)) return ROUND132_API_MESSAGE_COPY[source];
    // Preserve useful suffix data only for known safe prefix templates.
    if(source.indexOf('充值地址格式无效：') === 0) return 'Invalid deposit address format: ' + source.slice('充值地址格式无效：'.length);
    if(source.indexOf('接口不存在:') === 0 || source.indexOf('未知管理接口:') === 0) return 'Requested service endpoint is unavailable.';
    // Fail closed: never display an untranslated backend error in another locale.
    return ROUND132_UNKNOWN_SERVER_MESSAGE;
  }

  var SUPPORTED = ['zh-CN','zh-TW','en','ja','ko','vi'];
  var currentLang = 'zh-CN';
  var STORAGE_KEY = 'btcbox_lang';

  function detectLang(){
    // BTCBOX public frontend is English-only; ignore legacy locale preferences.
    return 'en';
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
    // Never leak Simplified Chinese fallback into another selected locale.
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : dict.translationUnavailable;
  }

  function translateElement(el){
    if(!el || !el.getAttribute) return;
    var key = el.getAttribute('data-i18n');
    if(key){
      var text = t(key);
      if(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
        if(el.placeholder !== text) el.placeholder = text;
      } else if(el.tagName === 'OPTION'){
        if(el.textContent !== text) el.textContent = text;
      } else {
        // Do not replace nested controls/icons; update only a dedicated text node
        // when the element contains child elements.
        var hasElementChild = Array.prototype.some.call(el.childNodes, function(n){ return n.nodeType === 1; });
        if(!hasElementChild){
          if(el.textContent !== text) el.textContent = text;
        } else {
          var textNode = Array.prototype.find.call(el.childNodes, function(n){ return n.nodeType === 3 && n.nodeValue.trim(); });
          if(textNode && textNode.nodeValue !== text) textNode.nodeValue = text;
        }
      }
    }
    var attrMap = {'data-i18n-placeholder':'placeholder','data-i18n-title':'title','data-i18n-aria-label':'aria-label','data-i18n-alt':'alt'};
    Object.keys(attrMap).forEach(function(attr){
      var attrKey = el.getAttribute(attr);
      if(attrKey){ var value = t(attrKey); if(el.getAttribute(attrMap[attr]) !== value) el.setAttribute(attrMap[attr], value); }
    });
  }

  function translateEnglishDynamicText(source){
    var prefixes = [
      ['可用余额 ', 'Available balance '], ['可用 ', 'Available '], ['投入 ', 'Amount '],
      ['到期：', 'Maturity: '], ['预期收益：', 'Expected return: '], ['年化：', 'APY: '],
      ['手续费：', 'Fee: '], ['到账数量', 'Amount received'], ['确认买入', 'Confirm Buy'],
      ['确认卖出', 'Confirm Sell'], ['提交中', 'Submitting'], ['加载中', 'Loading'],
      ['操作失败', 'Action failed'], ['网络异常', 'Network error'], ['审核中', 'Under review'],
      ['未实名认证', 'Identity not verified'], ['总资产估值', 'Total asset value'],
      ['今日盈亏', "Today's P&L"], ['余额不足', 'Insufficient balance'],
      ['当前参考价格暂不可用', 'Reference price is currently unavailable'],
      ['秒合约持仓查询失败', 'Failed to load contract positions'],
      ['暂无持仓', 'No open positions'], ['暂无记录', 'No records']
    ];
    for(var i=0;i<prefixes.length;i++){
      if(source.indexOf(prefixes[i][0]) === 0) return prefixes[i][1] + source.slice(prefixes[i][0].length);
    }
    return null;
  }

  function translateLooseText(root){
    if(!root || currentLang === 'zh-CN') return;
    var doc = root.ownerDocument || document;
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node){
        if(!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        var parent = node.parentElement;
        if(!parent || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if(parent.closest && parent.closest('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while((node = walker.nextNode())){
      var source = node.nodeValue.trim();
      if(Object.prototype.hasOwnProperty.call(ROUND131_PAGE_COPY, source)){
        var translated = ROUND131_PAGE_COPY[source];
        node.nodeValue = node.nodeValue.replace(source, translated);
      } else if(currentLang === 'en' && /[\u3400-\u9fff]/.test(source)) {
        // English-only public UI: translate common dynamic prefixes, then fail closed.
        var dynamicTranslation = translateEnglishDynamicText(source);
        node.nodeValue = node.nodeValue.replace(source, dynamicTranslation || 'Text unavailable');
      }
    }
  }

  function apply(root){
    root = root || document;
    if(root.matches && root.matches('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]')) translateElement(root);
    if(root.querySelectorAll) root.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label], [data-i18n-alt]').forEach(translateElement);
    translateLooseText(root);
    if(currentLang === 'en'){
      var sanitizeEnglishAttributes = function(el){
        if(!el || !el.getAttribute || !el.hasAttribute) return;
        ['placeholder','title','aria-label','alt'].forEach(function(attr){
          var value = el.getAttribute(attr);
          if(value && /[\u3400-\u9fff]/.test(value)) el.setAttribute(attr, 'Unavailable');
        });
      };
      var attrRoot = root.querySelectorAll ? root : document;
      if(root.matches && root.matches('[placeholder],[title],[aria-label],[alt]')) sanitizeEnglishAttributes(root);
      if(attrRoot.querySelectorAll) attrRoot.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(sanitizeEnglishAttributes);
    }
    if(root === document){
      // 设置 html lang 属性
      document.documentElement.setAttribute('lang', currentLang);
      // 通知动态导航和页面组件刷新文案
      document.dispatchEvent(new CustomEvent('langChange', {detail:{lang:currentLang}}));
    }
  }

  function setLang(lang){
    // Public frontend is intentionally English-only.
    if(lang !== 'en') return false;
    currentLang = 'en';
    try{ localStorage.setItem(STORAGE_KEY, 'en'); }catch(e){}
    apply();
    return true;
  }

  function getLang(){ return currentLang; }
  function getSupported(){ return SUPPORTED.slice(); }

  // 初始化
  currentLang = 'en';
  try{ localStorage.setItem(STORAGE_KEY, 'en'); }catch(e){}
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      apply();
      if(global.MutationObserver){
        var observer = new MutationObserver(function(records){
          records.forEach(function(record){
            if(record.type === 'attributes' && record.target) apply(record.target);
            Array.prototype.forEach.call(record.addedNodes || [], function(node){
              if(node.nodeType === 1) apply(node);
              else if(node.nodeType === 3 && node.parentElement) translateLooseText(node.parentElement);
            });
          });
        });
        observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['placeholder','title','aria-label','alt']});
      }
    });
  } else {
    apply();
    if(global.MutationObserver){
      var observer = new MutationObserver(function(records){
        records.forEach(function(record){
          if(record.type === 'attributes' && record.target) apply(record.target);
          Array.prototype.forEach.call(record.addedNodes || [], function(node){
            if(node.nodeType === 1) apply(node);
          });
        });
      });
      observer.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['placeholder','title','aria-label','alt']});
    }
  }


  // Round 177: also translate text nodes modified in place by timers, SDKs, and UI frameworks.
  // Keep this separate from the legacy child/attribute observer so its regression contract remains stable.
  function observeCharacterData(){
    if(!global.MutationObserver || !document.documentElement) return;
    var textObserver = new MutationObserver(function(records){
      records.forEach(function(record){
        if(record.type === 'characterData' && record.target && record.target.parentElement){
          translateLooseText(record.target.parentElement);
        }
      });
    });
    textObserver.observe(document.documentElement, {characterData:true, subtree:true});
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', observeCharacterData, {once:true});
  } else {
    observeCharacterData();
  }

  // Round 140: distinguish business outcomes from generic pending/empty states.
  var ROUND140_COPY = {
    'zh-CN': {withdrawTwofaMustEnableApiMessage:'此账号已启用双重验证，请输入验证码。',withdrawTwofaMustEnable:'此账号已启用双重验证，请输入验证码。',orderPartiallyFilled:'部分成交',depositFailed:'未到账',depositStatusUnknown:'状态未知，请稍后刷新',kycLoadFailed:'无法加载认证状态，请刷新重试',withdrawOutcomeUnknown:'提现结果暂未确认，请先刷新提现记录后再重试。',withdrawAlreadySubmitted:'该提现申请已接收，请勿重复提交。',kycRejected:'认证未通过，请检查资料后重新提交'},
    'zh-TW': {withdrawTwofaMustEnableApiMessage:'此帳號已啟用雙重驗證，請輸入驗證碼。',withdrawTwofaMustEnable:'此帳號已啟用雙重驗證，請輸入驗證碼。',orderPartiallyFilled:'部分成交',depositFailed:'未到帳',depositStatusUnknown:'狀態未知，請稍後重新整理',kycLoadFailed:'無法載入驗證狀態，請重新整理後重試',withdrawOutcomeUnknown:'提現結果尚未確認，請先重新整理提現紀錄再重試。',withdrawAlreadySubmitted:'此提現申請已受理，請勿重複提交。',kycRejected:'驗證未通過，請檢查資料後重新提交'},
    'en': {withdrawTwofaMustEnableApiMessage:'This account has 2FA enabled. Enter the verification code.',withdrawTwofaMustEnable:'This account has 2FA enabled. Enter the verification code.',orderPartiallyFilled:'Partially filled',depositFailed:'Not credited',depositStatusUnknown:'Status unavailable. Refresh later.',kycLoadFailed:'Could not load verification status. Refresh withdrawal history before retrying.',withdrawOutcomeUnknown:'The withdrawal result is not confirmed. Refresh withdrawal history before retrying.',withdrawAlreadySubmitted:'This withdrawal request was already received. Do not submit it again.',kycRejected:'Verification rejected. Review your details and resubmit.'},
    'ja': {withdrawTwofaMustEnableApiMessage:'このアカウントでは二要素認証が有効です。認証コードを入力してください。',withdrawTwofaMustEnable:'このアカウントでは二要素認証が有効です。認証コードを入力してください。',orderPartiallyFilled:'一部約定',depositFailed:'未入金',depositStatusUnknown:'状態を確認できません。後で更新してください',kycLoadFailed:'本人確認状況を読み込めません。更新して再試行してください',withdrawOutcomeUnknown:'出金結果を確認できません。出金履歴を更新してから再試行してください。',withdrawAlreadySubmitted:'この出金申請はすでに受け付けられています。重複送信しないでください。',kycRejected:'本人確認が却下されました。内容を確認して再提出してください'},
    'ko': {withdrawTwofaMustEnableApiMessage:'이 계정은 2단계 인증이 활성화되어 있습니다. 인증 코드를 입력하세요.',withdrawTwofaMustEnable:'이 계정은 2단계 인증이 활성화되어 있습니다. 인증 코드를 입력하세요.',orderPartiallyFilled:'일부 체결',depositFailed:'입금되지 않음',depositStatusUnknown:'상태를 확인할 수 없습니다. 나중에 새로고침하세요',kycLoadFailed:'인증 상태를 불러올 수 없습니다. 새로고침 후 다시 시도하세요',withdrawOutcomeUnknown:'출금 결과가 확인되지 않았습니다. 출금 내역을 새로고침한 후 다시 시도하세요.',withdrawAlreadySubmitted:'출금 요청이 이미 접수되었습니다. 중복 제출하지 마세요.',kycRejected:'인증이 거부되었습니다. 정보를 확인하고 다시 제출하세요'},
    'vi': {withdrawTwofaMustEnableApiMessage:'Tài khoản này đã bật xác thực hai yếu tố. Vui lòng nhập mã xác minh.',withdrawTwofaMustEnable:'Tài khoản này đã bật xác thực hai yếu tố. Vui lòng nhập mã xác minh.',orderPartiallyFilled:'Khớp một phần',depositFailed:'Chưa ghi có',depositStatusUnknown:'Chưa xác định được trạng thái. Hãy làm mới sau.',kycLoadFailed:'Không thể tải trạng thái xác minh. Hãy làm mới và thử lại.',withdrawOutcomeUnknown:'Chưa xác nhận được kết quả rút tiền. Hãy làm mới lịch sử rút trước khi thử lại.',withdrawAlreadySubmitted:'Yêu cầu rút tiền này đã được tiếp nhận. Không gửi lại.',kycRejected:'Xác minh bị từ chối. Hãy kiểm tra thông tin và gửi lại.'}
  };
  Object.keys(ROUND140_COPY).forEach(function(lang){ Object.keys(ROUND140_COPY[lang]).forEach(function(key){ DICT[lang][key] = ROUND140_COPY[lang][key]; }); });

  global.I18N = { t:t, translateMessage:translateMessage, setLang:setLang, getLang:getLang, getSupported:getSupported, apply:apply, DICT:DICT };
})(window);
