import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { COUPON } from "../../../common/constant/coupon.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 有人POSの株主優待
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 株主優待の売上取引を返品して、株主優待割引適用後の金額が返金される。
 * * * ・「株主優待割許可商品(対象)」と「株主優待割許可商品(上位参照)」が割引され、「株主優待割許可商品(対象外)」は割引されない
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 株主優待割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 株主優待バーコードスキャン | - |
 * | 5 | 株主優待割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 6 | 小計 | `/sales/subtotal` |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【返品】取引開始 | `/refund/begin` |
 * | 10 | 【返品】小計 | `/refund/subtotal` |
 * | 11 | 【返品】支払登録 | `/refund/addpayment` |
 * | 12 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_038で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.株主優待割許可商品(対象): 4931290077013
 * * 2.株主優待割許可商品(対象外): 2016020000010
 * * 3.株主優待割許可商品(上位参照): 0019014614035
 * * 4.株主優待 : K20180900
 * 
 * ---
 * ### 期待結果
 * * #### 6. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する（TC_038で実施する）。
 * * #### 7. 支払登録 `/sales/addpayment`
 * * \- 割引適用後の sales.payments[] データを取得する。
 * * #### 10.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 11.【返品】支払登録 `/refund/addpayment`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments は割引後の payment と一致していること。void_payments の内容：
 * * * * ・void_payments[].paid_cd = sales.payments[].paid_cd  
 * * * * ・void_payments[].paid_name = sales.payments[].paid_name  
 * * * * ・void_payments[].paid_amount = sales.payments[].paid_amount  
 * * \- 返品後の合計金額が0であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 12.【返品】取引完了 `/refund/end`
 * * \- レシートデータに「ご返金」という情報が含まれ、返金金額が販売取引と一致していることを確認する。
 */
export function TC_021946001_RefundShareholderBenefit() {
  group("TC_021946001 有人POSの株主優待", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      barcodeShareholderDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(対象外)スキャン"),
      barcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待バーコードスキャン"),
      barcodeShareholderDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "株主優待割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeShareholderDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_REFER_UPPER,
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
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(q => q.paid_cd == PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

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

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
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
      paidAmount: totalBalanceAmount,
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
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
