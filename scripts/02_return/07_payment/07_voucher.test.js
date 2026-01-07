import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function お米券
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.PAYMENT}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.CASH_VOUCHER}
 * {@link TAGS.OTHER_COMPANY_CASH_COUPONS_NO_CHANGE}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * お米券で支払った売上取引が返品できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/cart/voucher` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【返品】取引開始 | `/refund/begin` |
 * | 7 | 【返品】小計 | `/refund/subtotal` |
 * | 8 | 【返品】支払登録 | `/refund/cart/voucher` |
 * | 9 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_073で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * * 2. お米券
 * * voucher_code: "0612"
 * * voucher_name: "お米券"
 * * change_type: 1 (お釣り無し)
 * * coupon_amount: 440
 * 
 * ---
 * ### 期待結果
 * * ＊販売取引（TC_073）でデータ取得済み  
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータを取得する。
 * * #### 4. 支払登録 `/sales/cart/voucher`
 * * \- sales.payments[] のデータを取得する。
 * * ＊返品取引のデータが販売取引と一致することを確認する。  
 * * #### 7. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8. 【返品】支払登録 `/refund/cart/voucher`
 * * \- 返金金額が販売取引の金額と一致していることを確認する。
 * * * \+ void_payments に 金券 支払いが含まれる：
 * * * * \. void_payments[].paid_cd = sales.payments[].paid_cd
 * * * * \. void_payments[].paid_name = sales.payments[].paid_name
 * * * * \. void_payments[].voucher_cd= sales.payments[].voucher_cd
 * * * * \. void_payments[].voucher_name = sales.payments[].voucher_name
 * * * * \. void_payments[].paid_amount = sales.payments[].paid_amount
 * * \- 返品後の合計金額が 0 であることを確認する。
 * * * \+ total_balance_amount = 0
 * * #### 9. 【返品】取引完了 `/refund/end`
 * * \- レシートに以下の情報が含まれていることを確認する：
 * * * "お米券", "ご返金"  
 * * \- 返金金額が販売取引と一致していることを確認する。
 */
export function TC_020707001_RefundRiceCouponPayment() {
  group("TC_020707001 お米券", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_VOUCHER),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_VOUCHER),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const riceCouponAmount = 440; //Value of the rice coupon

    let cartNo = TestHelper.salesBegin(step.salesBegin, {}, [
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

    const payments = TestHelper.salesCartVoucher(step.salesPayment, {
      cartNo,
      voucherCode: COUPON.RICE_VOUCHER.CD,
      voucherBalanceAmount: riceCouponAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.payments;

    const paymentInfo = payments?.find(payment => payment.paid_cd === PAID_METHOD.VOUCHER.PAID_ITEMS.VOUCHER.PAID_CODE);

    const salesEndResponse = TestHelper.salesEnd(step.salesEnd, {
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
        expected: cartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundCartVoucher(step.refundPayment, {
      cartNo,
      voucherCode: COUPON.RICE_VOUCHER.CD,
      voucherBalanceAmount: riceCouponAmount,
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
        name: "Verify receipt data must contain information: お米券, ご返金 and refund amount is equal sales transaction",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(cartInfo?.total_balance_amount);
          return CommonFunction.includesItems([
            COUPON.RICE_VOUCHER.NAME,
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
