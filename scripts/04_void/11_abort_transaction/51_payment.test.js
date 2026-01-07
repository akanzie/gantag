import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CARD } from "../../../common/constant/card.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function クレジットカード払い
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CREDIT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * クレジットカードで支払った売上取引は誤打訂正の途中で中断ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~5の取引（売上）のレシートをスキャン | - |
 * | 7 | 【誤打訂正】支払登録 | `/void/addpayment` |
 * | 8 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.クレジットカード 
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * #### 4. 支払登録 `/sales/addpayment`
 * * \- sales.payments[] のデータ取得
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * #### 6.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 7.【誤打訂正】支払登録 `/void/addpayment`
 * * \- 返金（取消）支払いが販売取引の支払いと一致していることを確認
 * * * \+ void_payments.length = 1
 * * * \+ void_payments に クレジット支払いが含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返金後、合計残高が 0 となることを確認
 * * * \+ total_balance_amount = 0
 * * #### 8.【誤打訂正】取引中断 `/void/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041151001_AbortCreditCardPayment() {
  group("TC_041151001 クレジットカード払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CREDIT.GROUP_CODE,
      paidCode: PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.CREDIT_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd === PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const voidCreditPayment = voidCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE);

    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: voidCreditPayment?.paid_group_cd,
      paidCode: voidCreditPayment?.paid_cd,
      paidAmount: voidCreditPayment?.paid_amount,
      details: voidCreditPayment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 1 void payment method",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.void_payments?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify abort success and has receipt_no",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
};

/**
 * @function 電子マネー払い
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.WAON}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * WAONで支払った売上取引が誤打訂正の途中で中断ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~5の取引（売上）のレシートをスキャン | - |
 * | 7 | 【誤打訂正】支払登録 | `/void/addpayment` |
 * | 8 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.WAON
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * #### 4. 支払登録 `/sales/addpayment`
 * * \- sales.payments[] のデータ取得
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * #### 6.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 7.【誤打訂正】支払登録 `/void/addpayment`
 * * \- 取消支払いが販売取引の支払いと一致していることを確認
 * * * \+ void_payments.length = 1
 * * * \+ void_payments に WAON 支払いが含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返金後、合計残高が 0 となることを確認
 * * * \+ total_balance_amount = 0
 * * #### 8.【誤打訂正】取引中断 `/void/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041151002_AbortWaonPayment() {
  group("TC_041151002 電子マネー払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payments = TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.WAON_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const voidWaonPayment = voidCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);

    TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: voidWaonPayment?.paid_group_cd,
      paidCode: voidWaonPayment?.paid_cd,
      paidAmount: voidWaonPayment?.paid_amount,
      details: voidWaonPayment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 1 void payment method",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.void_payments?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify abort success and has receipt_no",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
};

/**
 * @function TMNプリペ払い
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.TMN_PREPAID}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * クスリのアオキギフトカードで支払った売上取引が誤打訂正の途中で中断ができる。
 * * （※ Step7とStep12の値は一致する想定ですが、誤打訂正キャンセルのあとでTMNプリペイのポイントは減少されていない）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | Aokiギフトカードが支払可能な金額にする | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | ポイント付与専用商品（対象外）スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | getbalance | - |
 * | 8 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 9 | TMNプリペバリュー返金 | `/tmn-prepaid/refund` |
 * | 10 | getbalance | - |
 * | 11 | 【誤打訂正】取引中断 | `/void/abort` |
 * | 12 | getbalance | - |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * 
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * \- sales.payments[] のデータ取得
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * 7.getbalance
 * * \- プリペイドカードの残高（value_amount_sum）の値を記録
 * * #### 8.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 9. TMNプリペバリュー返金 `/tmn-prepaid/refund`
 * * \- 取消支払いが販売取引の支払いと一致していることを確認
 * * * \+ void_payments に AOCA 取消支払いが含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * 10. getbalance　（※ Step7の値と同じ想定ですが、誤打訂正キャンセルのあとでポイントは減少されていない）
 * * \- 現在の残高が、記録していた残高に AOCA 取消支払金額を加算した金額と一致していることを確認
 * * * \+ value_amount_sum = value_amount_sum(Step7の値) + void_payments[].paid_amount
 * * #### 11.【誤打訂正】取引中断 `/void/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 * * 12. getbalance　（※ Step7の値と同じ想定ですが、誤打訂正キャンセルのあとでポイントは減少されていない）
 * * \- 現在の残高が Step7の値と一致するか確認
 * * * \+ value_amount_sum = value_amount_sum(Step7の値)
 */
export function TC_041151003_AbortGiftCardPayment() {
  group("TC_041151003 TMNプリペ払い", () => {
    const preStep = {
      generateKey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
    };

    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDedicatedPointGrantExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      generateKey1: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (1st)`),
      getBalance1: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (1st)`),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      refundTmnPrepaid: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_REFUND),
      generateKey2: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (2nd)`),
      getBalance2: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (2nd)`),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
      generateKey3: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION, `${ENDPOINT.TMN_PREPAID_CERTIFICATION.desc} (3rd)`),
      getBalance3: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE, `${ENDPOINT.TMN_PREPAID_GET_BALANCE.desc} (3rd)`),
    };

    const cardNo = CARD.AOKI_GIFT.CODE;
    let voidCardPayment = null;

    let cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeDedicatedPointGrantExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    // Check card balance to ensure the amount of card is payable
    TestHelper.tmnPrepaidCertification(preStep.generateKey, [
      CHECK.createStatusCodeCheck(),
    ]);

    const balance = TestHelper.tmnPrepaidGetBalance(preStep.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < salesCartInfo?.total_balance_amount) {
      TestHelper.tmnPrepaidDeposit(preStep.deposit, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: salesCartInfo?.total_balance_amount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    const payments = TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE,
      ],
      paidAmount: salesCartInfo?.total_balance_amount,
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd === PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    // Get key and call common function getbalance
    TestHelper.tmnPrepaidCertification(step.generateKey1, [
      CHECK.createStatusCodeCheck(),
    ]);

    const cardBalance = TestHelper.tmnPrepaidGetBalance(step.getBalance1, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.cart_no;

    TestHelper.tmnPrepaidRefund(step.refundTmnPrepaid, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payment equals the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          voidCardPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidCardPayment?.paid_cd,
            paidName: voidCardPayment?.paid_name,
            paidAmount: voidCardPayment?.paid_amount,
          };
        },
      }),
    ]);

    // Get key and call common function getbalance
    TestHelper.tmnPrepaidCertification(step.generateKey2, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalance2, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the current value balance equals the previously recorded value balance plus the AOCA void paid amount",
        expected: cardBalance + voidCardPayment?.paid_amount,
        actual: (res) => res.result?.card_info?.value_amount_sum,
      }),
    ]);

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify abort success and has receipt_no",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);

    // Get key and call common function getbalance
    TestHelper.tmnPrepaidCertification(step.generateKey3, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.tmnPrepaidGetBalance(step.getBalance3, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the current value balance equals the previously recorded value balance",
        expected: cardBalance,
        actual: (res) => res.result?.card_info?.value_amount_sum,
      }),
    ]);
  });
};

/**
 * @function ｄポイント払い
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.D_POINT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * ｄポイントで支払った売上取引が誤打訂正の途中で中断ができる。
 * * （TC_156と同じく、誤打訂正前dポイントが誤打訂正中断のあとの値と一致する想定ですが、誤打訂正中断のあとでポイントは減少されていない）。問題ないかご確認お願い致します。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | dポイント利用 | `/dpoint/usepoint` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~5の取引（売上）のレシートをスキャン | - |
 * | 7 | 【誤打訂正】支払登録 | `dpoint/usepointcancel` |
 * | 8 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.dPoint: 100000006699030
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * #### 4. 支払登録 `/dpoint/usepoint`
 * * \- sales.payments[] のデータ取得
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * \- value_amount_sum を記録
 * * #### 6.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * 現時点のdPointの残高確認
 * * #### 7.【誤打訂正】支払登録 `/dpoint/usepointcancel`
 * * \- dポイントの返金金額が販売取引の金額と一致していることを確認
 * * * \+ void_payments.length = 1
 * * * \+ void_payments に dポイント 支払いが含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返金後、合計残高が 0 となることを確認
 * * * \+ total_balance_amount = 0
 * * \- value_amount_sum が販売取引時に記録した値 + dポイント返金金額と一致することを確認
 * * #### 8.【誤打訂正】取引中断 `/void/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 * * 現時点のdPointの残高はStep6の残高と一致するか確認
 * * （TC_156と同じく、誤打訂正前dポイントが誤打訂正中断のあとの値と一致する想定ですが、誤打訂正中断のあとでポイントは減少されていない）。問題ないかご確認お願い致します。
 */
export function TC_041151004_VoidAbortDpointPayment() {
  group("TC_041151004 ｄポイント払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      dPointUsePoint: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      dPointUsePointCancel: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINTCANCEL),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const usePointCartInfo = TestHelper.dPointUsePoint(step.dPointUsePoint, {
      cartNo,
      pointUseAmount: salesCartInfo?.total_balance_amount,
      memberId: CARD.DPOINT.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const paymentInfo = usePointCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_CODE);
    const valueAmountSum = usePointCartInfo?.customer?.value_amount_sum;

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.cart_no;

    TestHelper.dPointUsePointCancel(step.dPointUsePointCancel, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 1 void payment method",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.void_payments?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount of dpoint in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paidAmount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidDpointPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo?.paid_cd);
          return {
            paidCd: voidDpointPayment?.paid_cd,
            paidName: voidDpointPayment?.paid_name,
            paidAmount: voidDpointPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify value amount sum equals the value recorded in the sales transaction plus dポイント payment amount refund",
        expected: valueAmountSum + paymentInfo?.paid_amount,
        actual: (res) => res.result?.cartinfo?.customer?.value_amount_sum,
      }),
    ]);

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify abort success and has receipt_no",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
};

/**
 * @function 掛売
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.CREDIT_SALE}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 掛売で支払った売上取引が誤打訂正の途中で中断ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 掛売客情報検索 | `/accounts-receivable/search` |
 * | 5 | 掛売支払登録 | `/sales/cart/accounts-receivable` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~6の取引（売上）のレシートをスキャン | - |
 * | 8 | 【誤打訂正】支払登録 | `/void/cart/accounts-receivable` |
 * | 9 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品 : 4500000000121
 * * 2.観客情報
 * * \- 売掛顧客コード: 1000000012 (client_cd)
 * * \- 電話番号: 0252400711 (client_tel_no)
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * #### 5. 支払登録 `/sales/cart/accounts-receivable`
 * * \- sales.payments[] のデータ取得
 * * * 誤打訂正データが販売取引と一致していることを確認
 * * #### 7.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8.【誤打訂正】支払登録 `/void/cart/accounts-receivable`
 * * \- 売掛金の返金金額が販売取引の金額と一致していることを確認
 * * * \+ void_payments.length = 1
 * * * \+ void_payments に 売掛金 支払いが含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返金後、合計残高が 0 となることを確認
 * * * \+ total_balance_amount = 0
 * * #### 9.【誤打訂正】取引中断 `/void/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041151005_AbortAccountsReceivablePayment() {
  group("TC_041151005 掛売", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      searchAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.ACCOUNTS_RECEIVABLE_SEARCH),
      accountsReceivable: CommonFunction.getFullDesc(ENDPOINT.SALES_ACCOUNTS_RECEIVABLE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.VOID_ACCOUNTS_RECEIVABLE),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    const paidCode = PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_CODE;

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const clientInfos = TestHelper.searchAccountsReceivable(step.searchAccountsReceivable, {}, [
      CHECK.createStatusCodeCheck(),
    ]).result?.client_infos;

    const clientInfo = clientInfos?.find(c => c.client_tel_no === ENVIRONMENT.CLIENT_TEL_NO);
    const clientCd = clientInfo?.client_cd;

    const payments = TestHelper.salesAccountsReceivable(step.accountsReceivable, {
      cartNo,
      clientCd,
      paidAmount: salesCartInfo?.total_balance_amount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const accountsReceivablePayment = payments?.find(p => p.paid_cd === paidCode);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const voidCartInfo = TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo;

    cartNo = voidCartInfo?.cart_no;
    const voidPayment = voidCartInfo?.payments?.find(p => p.paid_cd === paidCode);

    TestHelper.voidAccountsReceivable(step.voidAccountsReceivable, {
      cartNo,
      totalBalanceAmount: voidPayment?.paid_amount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 1 void payment method",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.void_payments?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: accountsReceivablePayment?.paid_cd,
          paidName: accountsReceivablePayment?.paid_name,
          paidAmount: accountsReceivablePayment?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === paidCode);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.voidAbort(step.voidAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify abort success and has receipt_no",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
}
