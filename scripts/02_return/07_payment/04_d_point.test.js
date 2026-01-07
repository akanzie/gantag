import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CARD } from "../../../common/constant/card.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function ｄポイント払い
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.POINT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.D_POINT}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * {@link TAGS.USE}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * ｄポイントで支払った売上取引が返品できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/dpoint/usepoint` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【返品】取引開始 | `/refund/begin` |
 * | 7 | 【返品】小計 | `/refund/subtotal` |
 * | 8 | 【dポイント】ポイント利用取消 | `/dpoint/usepointcancel` |
 * | 9 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_068で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. dPoint: 100000006699030
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_068で実施する）。
 * * #### 4. 支払登録 `/dpoint/usepoint`
 * * \- sales.payments[] データを取得する（dポイント支払い）。
 * * #### 7. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8. 【返品】支払登録 `/dpoint/usepointcancel`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments に dポイント支払が含まれる：
 * * * * ・void_payments[].paid_cd = sales.payments[].paid_cd  
 * * * * ・void_payments[].paid_name = sales.payments[].paid_name  
 * * * * ・void_payments[].paid_amount = sales.payments[].paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 9. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が含まれていることを確認する：
 * * * "dポイント", "ご返金"  
 * * \- 返金金額が販売取引と一致していることを確認する。
 */
export function TC_020704001_RefundDPointPayment() {
  group("TC_020704001 ｄポイント払い", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINTCANCEL),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.salesBegin, {
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

    const cartInfo = TestHelper.salesSubtotal(step.salesSubtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;
    const totalBalanceAmount = cartInfo?.total_balance_amount;
    const dPointUsed = totalBalanceAmount;
    const payments = TestHelper.dPointUsePoint(step.salesPayment, {
      cartNo,
      memberId: CARD.DPOINT.CODE,
      pointUseAmount: dPointUsed,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(payment => payment.paid_cd === PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_CODE);
    const salesEndResponse = TestHelper.salesEnd(step.salesEnd, {
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

    cartNo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: totalBalanceAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.dPointUsePointCancel(step.refundPayment, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCd: paymentInfo?.paid_cd,
          paidName: paymentInfo?.paid_name,
          paid_amount: paymentInfo?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === paymentInfo.paid_cd);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paid_amount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify the total balance amount equals 0 after refund",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: dポイント, ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_NAME,
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
