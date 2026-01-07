import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function WAON払い
 * @memberof 誤打訂正
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.WAON}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * WAONで支払った売上取引が誤打訂正により取消ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 (WAON) | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 8 | 【誤打訂正】支払登録 (WAON) | `/void/addpayment` |
 * | 9 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_063で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.NONPLU商品: 0445000701007
 * 
 * ---
 * ### 期待結果
 * * * データ取得（売上取引 TC_063 にて確認済）
 * * #### 4. 小計 `/sales/subtotal`
 * * \- sales.cartinfo を取得
 * * * WAON 支払データ検証
 * * #### 5. 支払登録 (WAON) `/sales/addpayment`
 * * \- 支払後の合計残高金額が 0 であることを確認
 * * * \+ total_balance_amount: 0
 * * \- カート情報に WAON 支払が含まれていることを確認
 * * * \+ waon_payment に以下が含まれること:
 * * * * \.paid_cd = "0307"
 * * * * \.paid_name = "WAON"
 * * * * \.paid_amount = sales.cartinfo.total_balance_amount
 * * * 誤打訂正データが売上取引と一致することを確認
 * * #### 7.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が売上取引の金額と一致することを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8.【誤打訂正】支払登録 (WAON) `/void/addpayment`
 * * \- 返金金額が売上取引の金額と一致することを確認
 * * * \+ void_payments に WAON 支払が含まれること
 * * * * \. void_payments[].paid_cd = waon_payment.paid_cd
 * * * * \. void_payments[].paid_name = waon_payment.paid_name
 * * * * \. void_payments[].paid_amount = waon_payment.paid_amount
 * * \- 返金後の合計残高金額が 0 であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 9.【誤打訂正】取引終了 `/void/end`
 * * \- レシートデータに「WAON」「誤打訂正」が含まれ、返金金額が売上取引と同額であることを確認
 */
export function TC_040729001_VoidWaonPayment() {
  group("TC_040729001 WAON払い（誤打訂正可）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (WAON)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT, "【誤打訂正】支払登録 (WAON)"),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
    };

    let waonPayment = null;

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

    TestHelper.salesCartBarcode(step.barcodeNonPlu, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.WAON_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount equals 0 after payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has WAON payment",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
          paidAmount: salesCartInfo?.total_balance_amount,
        },
        actual: (res) => {
          waonPayment = res.result?.cartinfo?.payments?.find(q => q.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);
          return {
            paidCd: waonPayment?.paid_cd,
            paidName: waonPayment?.paid_name,
            paidAmount: waonPayment?.paid_amount,
          };
        },
      }),
    ]);

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
    const payment = voidCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);

    const totalBalanceAmount = TestHelper.voidPayment(step.voidPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: payment?.paid_amount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: waonPayment?.paid_cd,
          paidName: waonPayment?.paid_name,
          paidAmount: waonPayment?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === waonPayment?.paid_cd);
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
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: WAON, 誤打訂正 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
            "誤打訂正",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}

/**
 * @function 交通系IC払い
 * @memberof 誤打訂正
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.TRANSPORTATION_IC}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 交通系ICで支払った売上取引は誤打訂正ができない。（誤打訂正不可）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 (交通系IC) | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【誤打訂正】取引開始 | `/void/begin` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_064で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.NONPLU商品: 0445000701007
 * * 3.交通系IC
 * 
 * ---
 * ### 期待結果
 * * * データ取得（売上取引 TC_064 にて確認済）
 * * #### 4. 小計 `/sales/subtotal`
 * * \- sales.cartinfo を取得
 * * * 交通系IC 支払データ検証
 * * #### 5. 支払登録 (交通系IC) `/sales/addpayment`
 * * \- 支払後の合計残高金額が 0 であることを確認
 * * * \+ total_balance_amount: 0
 * * \- カート情報に交通系IC支払が含まれていることを確認
 * * * \+ 交通系IC payment に以下が含まれること:
 * * * * \.paid_cd = "0303"
 * * * * \.paid_name = "交通系IC"
 * * * * \.paid_amount = sales.cartinfo.total_balance_amount
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートが正常に印字され、決済方法として 1 つの支払種別（交通系IC）が含まれていることを確認
 * * * 誤打訂正取引データ検証
 * * #### 7.【誤打訂正】取引開始 `/void/begin`
 * * \- レスポンスを確認
 * * * \+ Status: 220
 * * * \+ Error message: "返金不可な支払が存在します。"
 * * * \+ Error code: "PAY0011"
 */
export function TC_040729002_VoidIcPayment() {
  group("TC_040729002 交通系IC払い（誤打訂正不可）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (交通系IC)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
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

    TestHelper.salesCartBarcode(step.barcodeNonPlu, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NONPLU,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.KOUTSU_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount equals 0 after payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 交通系IC payment",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_NAME,
          paidAmount: salesCartInfo?.total_balance_amount,
        },
        actual: (res) => {
          const icPayment = res.result?.cartinfo?.payments?.find(q => q.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_CODE);
          return {
            paidCd: icPayment?.paid_cd,
            paidName: icPayment?.paid_name,
            paidAmount: icPayment?.paid_amount,
          };
        },
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 1 payment method",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PAID_METHOD.E_MONEY.PAID_ITEMS.IC.PAID_NAME,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse.result?.receipt_no;
    const salesBusinessDay = salesEndResponse.result?.business_day;

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesReceiptNo,
      businessDay: salesBusinessDay,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    TestHelper.voidBegin(step.voidBegin, {
      receiptBarcode,
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("PAY0011", "返金不可な支払が存在します。"),
    ]);
  });
}
