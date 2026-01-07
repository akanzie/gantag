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
 * @function PayPay払い
 * @memberof 誤打訂正
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.RECEIPT_PRINTING}
 * {@link TAGS.CODE_PAYMENT}
 * {@link TAGS.MISPRINT_CORRECTION_RECEIPT}
 * ### テスト観点
 * * 前提：
 * * 「m_payment」で「void_refund_pattern_type」フラグを「2」に設定する (元支払返金)
 * * テスト観点：
 * * PayPayで支払った売上取引は誤打訂正ができる。（誤打訂正可）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 (PayPay) | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【誤打訂正】取引開始 | `/void/begin` |
 * | 7 | 【誤打訂正】支払登録 (PayPay) | `/void/addpayment` |
 * | 8 | 【誤打訂正】取引終了 | `/void/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_072で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. PayPay
 * 
 * ---
 * ### 期待結果
 * *  * データ取得（売上取引 TC_072 にて確認済）
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo を取得
 * * #### 4. 支払登録 (PayPay) `/sales/addpayment`
 * * \- sales.payments[] を取得
 * *  * 誤打訂正データが売上取引と一致することを確認
 * * #### 6.【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が売上取引の金額と一致することを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 7.【誤打訂正】支払登録 (PayPay) `/void/addpayment`
 * * \- 返金金額が売上取引の金額と一致することを確認
 * * * \+ void_payments に PayPay 支払が含まれること
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返金後の合計残高金額が 0 であることを確認
 * * * \+ total_balance_amount = 0
 * * #### 8.【誤打訂正】取引終了 `/void/end`
 * * \- レシートデータに「PayPay」「誤打訂正」が含まれ、返金金額が売上取引と同額であることを確認
 */
export function TC_040732001_VoidPayPayPayment() {
  group("TC_040732001 PayPay払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (PayPay)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidPayment: CommonFunction.getFullDesc(ENDPOINT.VOID_PAYMENT, "【誤打訂正】支払登録 (PayPay)"),
      voidEnd: CommonFunction.getFullDesc(ENDPOINT.VOID_END),
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
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.PAYPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_CODE);

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
    const payment = voidCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_CODE);

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
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.voidEnd(step.voidEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: PayPay, 誤打訂正 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.QRCODE.PAID_ITEMS.PAY_PAY.PAID_NAME,
            "誤打訂正",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
