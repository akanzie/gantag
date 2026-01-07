import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function WAON払い
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.SETTLEMENT}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.WAON}
 * {@link TAGS.CANCELLATION_RETURN}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * WAONで支払った売上取引が返品できる。
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
 * | 7 | 【返品】取引開始 | `/refund/begin` |
 * | 8 | 【返品】小計 | `/refund/subtotal` |
 * | 9 | 【返品】支払登録 (WAON) | `/refund/addpayment` |
 * | 10 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_063で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. NONPLU商品: 0445000701007
 * * 3. WAON
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_063で実施する）。
 * * #### 5. 支払登録 (WAON) `/sales/addpayment`
 * * \- WAON支払いを確認する。
 * * * \+ total_balance_amount = 0
 * * * \+ waon_payment の内容を記録：
 * * * * ・paid_cd = "0307"  
 * * * * ・paid_name = "WAON"  
 * * * * ・paid_amount = 540  
 * * #### 8. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 9. 【返品】支払登録 (WAON) `/refund/addpayment`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments に WAON 支払いが含まれる：
 * * * * ・void_payments[].paid_cd = waon_payment.paid_cd  
 * * * * ・void_payments[].paid_name = waon_payment.paid_name  
 * * * * ・void_payments[].paid_amount = waon_payment.paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 10. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が含まれていることを確認する：
 * * * "WAON", "ご返金"  
 * * \- 返金金額が販売取引と一致していることを確認する。
 */
export function TC_020729001_WaonPayment() {
  group("TC_020729001 WAON払い", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPLU: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, `${ENDPOINT.SALES_ADDPAYMENT.desc} (WAON)`),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT, `${ENDPOINT.REFUND_PAYMENT.desc} (WAON)`),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
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

    TestHelper.salesCartBarcode(step.barcodeNonPLU, {
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
        name: "Verify total balance amount",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify WAON payment has been applied",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
          paidAmount: salesCartInfo?.total_balance_amount,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);
          return {
            paidCd: payment?.paid_cd,
            paidName: payment?.paid_name,
            paidAmount: payment?.paid_amount,
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

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);

    const totalPaidAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      details: payment?.details,
      paidAmount: totalPaidAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payments contains WAON payment",
        expected: {
          paidCd: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
          paidName: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
          paidAmount: salesCartInfo?.total_balance_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);
          return {
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: WAON, ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalPaidAmount);
          return CommonFunction.includesItems([
            PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_NAME,
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
