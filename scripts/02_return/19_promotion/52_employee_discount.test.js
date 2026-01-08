import * as CHECK from "../../../common/common_check.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 有人POSの社員割引
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.CHANGE_DETAILS}
 * {@link TAGS.COMPANY_DISCOUNT}
 * {@link TAGS.SINGLE_ITEM_DISCOUNT}
 * ### テスト観点
 * * 前提：
 * * 社員割引した売上のレシート返品を行う。
 * * テスト観点：
 * * 社員割引の売上取引を返品して、社員割引適用後の金額が返金される。
 * * * ・商品Aと商品Cが割引され（社割許可商品(対象)、社割許可商品(上位参照)）
 * * * ・商品Bは割引されない（社割許可商品(対象外)）
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 社割許可商品(対象)スキャン | `/sales/cart/barcode` |
 * | 3 | 社割許可商品(対象外)スキャン | `/sales/cart/barcode` |
 * | 4 | 社員割引バーコードスキャン | - |
 * | 5 | 社割許可商品(上位参照)スキャン | `/sales/cart/barcode` |
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
 * * 売上取引「有人POSの社員割引」に対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 1.社割許可商品(対象): 4931290077006
 * * 2.社割許可商品(対象外): 2016020000003
 * * 3.社員割引券 : S01000020W
 * * 4.社割許可商品(上位参照): 0017800174527
 * 
 * ---
 * ### 期待結果
 * * #### 6.小計 `/sales/subtotal`
 * * sales.cartInfo を保持（元取引）
 * * #### 10. 【返品】小計   `/refund/subtotal`
 * * カートInfoを確認:
 * * * \+ total_balance_amount= sale.cartinfo.total_balance_amount
 * * * \+ total_quantity= sale.cartinfo.total_quantity
 * * カートInfoに 社社割許可商品(対象) が元取引と一致しているか確認:
 * * * \+item[0].barcode = sale.cartinfo.item[0].barcode
 * * * \+item[0].total_statement_amount= sale.cartinfo.item[0].total_statement_amount
 * * * \+item[0].quantity= sale.cartinfo.item[0].quantity
 * * * \+item[0].subtotal_discount_apportionment= sale.cartinfo.item[0].subtotal_discount_apportionment
 * * カートInfoに 社割許可商品(対象外) が元取引と一致しているか確認:
 * * * \+item[1].barcode = sale.cartinfo.item[1].barcode
 * * * \+item[1].total_statement_amount= sale.cartinfo.item[1].total_statement_amount
 * * * \+item[1].quantity= sale.cartinfo.item[1].quantity
 * * * \+item[1].subtotal_discount_apportionment= sale.cartinfo.item[1].subtotal_discount_apportionment
 * * カートInfoに 社割許可商品(上位参照) が元取引と一致しているか確認:
 * * * \+item[2].barcode = sale.cartinfo.item[2].barcode
 * * * \+item[2].total_statement_amount= sale.cartinfo.item[2].total_statement_amount
 * * * \+item[2].quantity= sale.cartinfo.item[2].quantity
 * * * \+item[2].subtotal_discount_apportionment= sale.cartinfo.item[2].subtotal_discount_apportionment
 * * #### 11. 【返品】支払登録 `/refund/addpayment`
 * * \- Confirm the refund amount đã được hoàn trả theo đúng với giao dịch gốc :
 * * * \+ total_balance_amount = 0 (sale.cartinfo.total_balance_amount-  void_payments[].paid_amount)
 * * * \+ payments[].paid_amount = sale.cartinfo.total_balance_amount
 * * * \+ void_payments[].paid_amount = sale.cartinfo.total_balance_amount"
 */
export function TC_021952001_CheckSelfPOSDiscountForEmployee() {
  group("TC_021952001 セルフPOSの社員割引（正常系）", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      salesBarcodeEmployeeDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象)スキャン"),
      salesBarcodeEmployeeDiscountExclude: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(対象外)スキャン"),
      salesBarcodeEmployeeDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社員割引バーコードスキャン"),
      salesBarcodeEmployeeDiscountReferUpper: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "社割許可商品(上位参照)スキャン"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const salesCartNo = TestHelper.salesBegin(step.salesBegin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeEmployeeDiscountAllowed, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeEmployeeDiscountExclude, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_EXCLUDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeEmployeeDiscount, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: COUPON.EMPLOYEE_DISCOUNT.CD,
          scan_data_type: "Code39",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeEmployeeDiscountReferUpper, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.EMPLOYEE_DISCOUNT_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.salesSubtotal, salesCartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.salesPayment, {
      cartNo: salesCartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.salesEnd, {
      cartNo: salesCartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const salesReceiptNo = salesEndResponse?.result?.receipt_no;
    const salesBusinessDay = salesEndResponse?.result?.business_day;

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

    const refundCartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo: refundCartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info the correct refunded total blance amount and total quantity",
        expected: {
          totalBalanceAmount: salesCartInfo?.total_balance_amount,
          totalQuantity: salesCartInfo?.total_quantity,
        },
        actual: (res) => {
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            totalQuantity: res.result?.cartinfo?.total_quantity,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 社割許可商品(対象) reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemEmployeeDiscountAllowed = salesCartInfo?.items?.[0];
          return {
            barcode: salesItemEmployeeDiscountAllowed?.barcode,
            totalStatementAmount: salesItemEmployeeDiscountAllowed?.total_statement_amount,
            quantity: salesItemEmployeeDiscountAllowed?.quantity,
            subtotalDiscountApportionment: salesItemEmployeeDiscountAllowed?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const refundItemEmployeeDiscountAllowed = res.result?.cartinfo?.items?.[0];
          return {
            barcode: refundItemEmployeeDiscountAllowed?.barcode,
            totalStatementAmount: refundItemEmployeeDiscountAllowed?.total_statement_amount,
            quantity: refundItemEmployeeDiscountAllowed?.quantity,
            subtotalDiscountApportionment: refundItemEmployeeDiscountAllowed?.subtotal_discount_apportionment,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 社割許可商品(対象外) reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemEmployeeDiscountExclude = salesCartInfo?.items?.[1];
          return {
            barcode: salesItemEmployeeDiscountExclude?.barcode,
            totalStatementAmount: salesItemEmployeeDiscountExclude?.total_statement_amount,
            quantity: salesItemEmployeeDiscountExclude?.quantity,
            subtotalDiscountApportionment: salesItemEmployeeDiscountExclude?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const refundItemEmployeeDiscountExclude = res.result?.cartinfo?.items?.[1];
          return {
            barcode: refundItemEmployeeDiscountExclude?.barcode,
            totalStatementAmount: refundItemEmployeeDiscountExclude?.total_statement_amount,
            quantity: refundItemEmployeeDiscountExclude?.quantity,
            subtotalDiscountApportionment: refundItemEmployeeDiscountExclude?.subtotal_discount_apportionment,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 社割許可商品(上位参照) reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemEmployeeDiscountReferUpper = salesCartInfo?.items?.[2];
          return {
            salesBarcode: salesItemEmployeeDiscountReferUpper?.barcode,
            totalStatementAmount: salesItemEmployeeDiscountReferUpper?.total_statement_amount,
            quantity: salesItemEmployeeDiscountReferUpper?.quantity,
            subtotalDiscountApportionment: salesItemEmployeeDiscountReferUpper?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const refundItemEmployeeDiscountReferUpper = res.result?.cartinfo?.items?.[2];
          return {
            salesBarcode: refundItemEmployeeDiscountReferUpper?.barcode,
            totalStatementAmount: refundItemEmployeeDiscountReferUpper?.total_statement_amount,
            quantity: refundItemEmployeeDiscountReferUpper?.quantity,
            subtotalDiscountApportionment: refundItemEmployeeDiscountReferUpper?.subtotal_discount_apportionment,
          };
        },
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo: refundCartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount is consistent with the original transaction",
        expected: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          return {
            totalBalanceAmount: salesCartInfo?.total_balance_amount - voidPayment?.paid_amount,
            paymentPaidAmount: salesCartInfo?.total_balance_amount,
            voidPaymentPaidAmount: salesCartInfo?.total_balance_amount,
          };
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentPaidAmount: payment?.paid_amount,
            voidPaymentPaidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo: refundCartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);
  });
}
