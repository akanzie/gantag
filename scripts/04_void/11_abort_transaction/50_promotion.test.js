import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { COUPON } from "../../../common/constant/coupon.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 社員割引
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.EMPLOYEE_DISCOUNT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 社員割引の売上取引が誤打訂正の途中で中断ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 社員割引バーコードスキャン | - |
 * | 7 | 支払登録 | `/sales/addpayment` |
 * | 8 | 取引完了 | `/sales/end` |
 * | 9 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~8の取引（売上）のレシートをスキャン | - |
 * | 10 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_030で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.社割許可商品(対象): 4931290077006
 * * 2.社割許可商品(対象外): 2016020000003
 * * 3.社割許可商品(上位参照): 0017800174527
 * * 4.社員割引券: S01000020W
 * 
 * ---
 * ### 期待結果
 * *  * データ取得（販売取引 TC_030 にて検証済み）
 * * 6.社員割引バーコードスキャン
 * * \- 社員割引の支払データを取得（voucher_cd: S01000020W）
 * * \- total_balance_amount を取得
 * * #### 9. 【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致することを確認
 * * * \+ total_balance_amount = sales.total_balance_amount
 * * \- 返金金額が販売取引の社員割引の金額と一致することを確認
 * * * \+ void_payments に社員割引が含まれていること
 * * * * \. void_payments[].voucher_cd = employee discount payment.voucher_cd
 * * * * \. void_payments[].voucher_name = employee discount payment.voucher_name
 * * * * \. void_payments[].paid_amount = employee discount payment.paid_amount
 * * #### 10. 【誤打訂正】取引中断 `/void/abort`
 * * \- 中断成功および receipt_no が付与されていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041150001_AbortEmployeeDiscount() {
  group("TC_041150001 社員割引", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      barcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      barcodeEmployeeDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      barcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountExclude, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeEmployeeDiscountReferUpper, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesCartBarcode(step.barcodeEmployeeDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const payment = salesCartInfo?.payments?.find(q => q.voucher_cd === COUPON.EMPLOYEE_DISCOUNT.CD);

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
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
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount of employee discount in sales transaction",
        expected: {
          paidCd: payment?.voucher_cd,
          paidName: payment?.voucher_name,
          paidAmount: payment?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(q => q.voucher_cd === COUPON.EMPLOYEE_DISCOUNT.CD);
          return {
            paidCd: voidPayment?.voucher_cd,
            paidName: voidPayment?.voucher_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]).result?.cartinfo?.cart_no;

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
