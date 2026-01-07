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
 * @function 小計値引した売上の返品
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SUBTOTAL}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.SUBTOTAL_MANUAL_REDUCTION}
 * ### テスト観点
 * * 前提：
 * * 小計値引した売上のレシート返品を行う
 * * テスト観点：
 * * * ・小計値引した売上取引を返品して、小計値引後の金額が返金される。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 単品値引商品スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 小計値引ボタンを押下し値引金額入力 | `/sales/cart/subtotaldiscount` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 【返品】取引開始 | `/refund/begin` |
 * | 9 | 【返品】小計 | `/refund/subtotal` |
 * | 10 | 【返品】支払登録 | `/refund/addpayment` |
 * | 11 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.単品値引商品: 2099998000039
 * * 2.通常商品: 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * \- sales.cartinfoを確認
 * * #### 5.小計値引ボタンを押下し値引金額入力 `/sales/cart/subtotaldiscount`
 * * \- 値引額 = response.subtotal_discounts[].subtotal_discount_amount　か確認
 * * #### 9.【返品】小計 `/refund/subtotal`
 * * #### - 割引額 = 40 (5.小計値引ボタンを押下し値引金額入力 `/sales/cart/subtotaldiscount`)
 * * \- 割引適用後の金額を確認
 * * * \+ 単品値引商品 は4000, 税 0%
 * * \->単品値引商品の合計金額への割当計算：
 * * operation_subtotal_discount_apportionment = (items[0].unit_price / (items[0].unit_price + items[1].unit_price)) × 割引額
 * * ＝ (4000 / (4000 + 400)) × 40 = 37（四捨五入で切り上げ）
 * * * \+ 通常商品 は 400, 税 8%
 * * \-> 通常商品の合計金額への割当計算：
 * * operation_subtotal_discount_apportionment = (items[1].unit_price / (items[0].unit_price + items[1].unit_price)) × 割引額
 * * ＝ (400 / (4000 + 400)) × 40 = 4（四捨五入で切り上げ）
 * * * \+  小計値引・割引の差分
 * * operation_subtotal_discount_fraction = 値引・割引額 − （単品値引商品の割当額 ＋ 通常商品の割当額）
 * * ＝ 40 − (37 + 4) = -1
 * * * \+ 商品価格（高 → 低）に基づいて値引額を再分配する：
 * * → 単品値引商品の正しい割当額 = 単品値引商品の計算済み割当額 + operation_subtotal_discount_fraction
 * * ＝ 37 + (-1) = 36
 * * * \+ 税金 = (items[0].unit_price − 単品値引商品の正しい割当額) × (items[0].tax_rate / 100) ＋ (items[1].unit_price − 通常商品の計算済み割当額) × (tax_rate / 100)
 * * ＝ (4000 − 36) × 0% ＋ (400 − 4) × 8% = 31（切り捨て）
 * * * \+ total_paid_amount = ((items[0].unit_price + items[1].unit_price) - 値引・割引額) + 税金 = ((4000+400)- 40) + 31 = 4391 = sales.total_sales_amount
 * * #### 10.【返品】支払登録 `/refund/addpayment`
 * * \- 返金額　＝ sales.total_sales_amount　であるかどうか確認
 * * * \+ void_payments の paid_amount = sales.total_sales_amount
 * * #### 11.【返品】取引完了 `/refund/end`
 * * \- レシートデータにて "ご返金"の情報があるか確認
 * * \- 返金額が "4391"か確認
 */
export function TC_020817001_SubtotalDiscountedReturns() {
  group("TC_020817001 小計値引した売上の返品", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeSingleDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "単品値引商品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      subtotalDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_SUBTOTAL_DISCOUNT, "小計値引ボタンを押下し値引金額入力"),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const discountValue = 40; // Manual import discount amount
    const discountType = 2; // Indicates that the total amount will be deducted directly from manual import (値引額)

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeSingleDiscount, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SINGLE_DISCOUNT,
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

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotalDiscount(step.subtotalDiscount, {
      cartNo,
      discountType,
      discountValue,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const totalBalanceAmount = salesCartInfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    //3秒待機
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
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const totalPaidAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the total amount after applying the discount",
        expected: salesCartInfo?.total_sales_amount,
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: totalPaidAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount is equal total paid amount",
        expected: totalPaidAmount,
        actual: (res) => res.result?.cartinfo?.void_payments?.[0]?.paid_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: `Receipt data must contains: ご返金 and refund amount ${totalPaidAmount}`,
        expected: true,
        actual: (res) => {
          // Convert number to string currency
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalPaidAmount);
          return CommonFunction.includesItems([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts?.[0]?.receipt_data);
        },
      }),
    ]);
  });
}
