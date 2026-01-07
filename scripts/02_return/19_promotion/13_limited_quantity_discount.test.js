import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { group, sleep } from "k6";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function ひとつの販促コードに紐づく商品が１商品
例）商品A（単価100円）3点まで90円
　　→　3個購入までは1点90円
　　　　4個からは通常価格100円となる。
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.SPECIAL_SALE_POP_PRODUCT_MASTER}
 * ### テスト観点
 * * 前提：
 * * 個数限定割引した売上のレシート返品を行う。
 * * テスト観点：
 * * 個数限定割引の売上取引を返品して、個数限定割引適用後の金額が返金される。
 * * * ・販促品（値引額）、販促品（割引率）、販促品（価格）、非販促品は販促_商品明細マスタに登録されている商品。
 * * * * →　販促品（値引額）：販促値引額の販促商品明細マスタ
 * * * * 販促品（割引率）：販促割引率の販促商品明細マスタ
 * * * * 販促品（価格）：販促価格の販促商品明細マスタ
 * * * * 上記の販促品（値引額）と販促品（割引率）はすべて個数限定割引が適用される。
 * * * * 販促品（価格）は値引が適用される数量のみ個数限定値引が適用される。
 * * * * 超過分は割引されない。
 * * * ・非販促品は販促_商品明細マスタに登録されていない商品。
 * * * * →　個別限定割引とは関係ない商品で個数限定割引は適用されない。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | - | "取引①：前提 | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 販促品（値引額） スキャン | `/sales/cart/barcode` |
 * | 3 | 販促品（値引額）数量変更 | `/sales/cart/changeitemquantity` |
 * | 4 | 販促品（割引率）スキャン | `/sales/cart/barcode` |
 * | - | →販促品（値引額）と2は、値引が適用される数量分スキャンする | - |
 * | 5 | 販促品（割引率）数量変更 | `/sales/cart/changeitemquantity` |
 * | 6 | 販促品（価格）スキャン | `/sales/cart/barcode` |
 * | - | →販促品（価格）は、値引が適用される数量分＋１個スキャンする | - |
 * | 7 | 販促品（価格）数量変更 | `/sales/cart/changeitemquantity` |
 * | 8 | 非販促品スキャン | `/sales/cart/barcode` |
 * | 9 | 小計 | `/sales/subtotal` |
 * | 10 | 支払登録 | `/sales/addpayment` |
 * | 11 | 取引完了 | `/sales/end` |
 * | - | 取引②：返品テスト | - |
 * | 12 | 【返品】取引開始 | `/refund/begin` |
 * | 13 | 【返品】小計 | `/refund/subtotal` |
 * | 14 | 【返品】支払登録 | `/refund/addpayment` |
 * | 15 | 【返品】取引完了 | `/refund/end"` |
 * 
 * ---
 * ### 前提条件
 * * 売上取引「ひとつの販促コードに紐づく商品が１商品」に対してレシート返品を実行する
 * 
 * ---
 * ### テストデータ
 * * 1.販促品（値引額）: 4500000002501
 * * 2.販促品（割引率）: 4500000002502
 * * 3.販促品（価格）: 4500000002503
 * * 4.非販促品: 4500000002504
 * * 5.販促値引額: 12501
 * * 6.販促割引率: 12502
 * * 7.販促価格: 12503
 * 
 * ---
 * ### 期待結果
 * * #### 9.小計 `/sales/subtotal`
 * * sales.cartInfo を保持（元取引）
 * * #### 13. 【返品】小計   `/refund/subtotal`
 * * カートInfoを確認:
 * * * \+ total_balance_amount= sale.cartinfo.total_balance_amount
 * * * \+ total_quantity= sale.cartinfo.total_quantity
 * * カートInfoに 販促品（値引額）が元取引と一致しているか確認:
 * * * \+item[0].barcode = sale.cartinfo.item[0].barcode
 * * * \+item[0].total_statement_amount= sale.cartinfo.item[0].total_statement_amount
 * * * \+item[0].quantity= sale.cartinfo.item[0].quantity
 * * * \+item[0].subtotal_discount_apportionment= sale.cartinfo.item[0].subtotal_discount_apportionment
 * * カートInfoに 販促品（割引率）が元取引と一致しているか確認:
 * * * \+item[1].barcode = sale.cartinfo.item[1].barcode
 * * * \+item[1].total_statement_amount= sale.cartinfo.item[1].total_statement_amount
 * * * \+item[1].quantity= sale.cartinfo.item[1].quantity
 * * * \+item[1].subtotal_discount_apportionment= sale.cartinfo.item[1].subtotal_discount_apportionment
 * * カートInfoに販促品（価格）が元取引と一致しているか確認:
 * * * \+item[2].barcode = sale.cartinfo.item[2].barcode
 * * * \+item[2].total_statement_amount= sale.cartinfo.item[2].total_statement_amount
 * * * \+item[2].quantity= sale.cartinfo.item[2].quantity
 * * * \+item[2].subtotal_discount_apportionment= sale.cartinfo.item[2].subtotal_discount_apportionment
 * * * \+item[3].barcode = sale.cartinfo.item[3].barcode
 * * * \+item[3].total_statement_amount= sale.cartinfo.item[3].total_statement_amount
 * * * \+item[3].quantity= sale.cartinfo.item[3].quantity
 * * * \+item[3].subtotal_discount_apportionment= sale.cartinfo.item[3].subtotal_discount_apportionment
 * * カートInfoに 非販促品が元取引と一致している確認:
 * * * \+item[4].barcode = sale.cartinfo.item[4].barcode
 * * * \+item[4].total_statement_amount= sale.cartinfo.item[4].total_statement_amount
 * * * \+item[4].quantity= sale.cartinfo.item[4].quantity
 * * * \+item[4].subtotal_discount_apportionment= sale.cartinfo.item[4].subtotal_discount_apportionment
 * * #### 14. 【返品】支払登録 `/refund/addpayment`
 * * \- 返金額を確認:
 * * * \+ total_balance_amount = 0
 * * * \+ payments[].paid_amount = sale.cartinfo.total_balance_amount
 * * * \+ void_payments[].paid_amount = sale.cartinfo.total_balance_amount
 */
export function TC_021913001_LimitedQuantityDiscount() {
  group("TC_021913001 ひとつの販促コードに紐づく商品が１商品", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      salesBarcodeItemDiscountAmount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（値引額）スキャン"),
      salesChangeQuantityItemDiscountAmount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "販促品（値引額）数量変更"),
      salesBarcodeItemDiscountRate: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（割引率）スキャン"),
      salesChangeQuantityItemDiscountRate: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "販促品（割引率）数量変更"),
      salesBarcodeItemPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "販促品（価格）スキャン"),
      salesChangeQuantityItemPrice: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "販促品（価格）数量変更"),
      salesBarcodeNonPromo: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "非販促品スキャン"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const updatedQuantity = 2; // Test data

    const salesCartNo = TestHelper.salesBegin(step.salesBegin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeItemDiscountAmount, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.ITEM_DISCOUNT_AMOUNT,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartChangeItemQuantity(step.salesChangeQuantityItemDiscountAmount, {
      cartNo: salesCartNo,
      statementNo: 0,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeItemDiscountRate, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.ITEM_DISCOUNT_RATE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartChangeItemQuantity(step.salesChangeQuantityItemDiscountRate, {
      cartNo: salesCartNo,
      statementNo: 1,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeItemPrice, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.ITEM_PRICE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartChangeItemQuantity(step.salesChangeQuantityItemPrice, {
      cartNo: salesCartNo,
      statementNo: 2,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.salesBarcodeNonPromo, {
      cartNo: salesCartNo,
      barcodes: [
        {
          barcode: PROD.NON_PROMO,
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
        name: "Verify cart info has 販促品（値引額) reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemDiscountAmount = salesCartInfo?.items?.[0];
          return {
            barcode: salesItemDiscountAmount?.barcode,
            totalStatementAmount: salesItemDiscountAmount?.total_statement_amount,
            quantity: salesItemDiscountAmount?.quantity,
            subtotalDiscountApportionment: salesItemDiscountAmount?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const refundItemDiscountAmount = res.result?.cartinfo?.items?.[0];
          return {
            barcode: refundItemDiscountAmount?.barcode,
            totalStatementAmount: refundItemDiscountAmount?.total_statement_amount,
            quantity: refundItemDiscountAmount?.quantity,
            subtotalDiscountApportionment: refundItemDiscountAmount?.subtotal_discount_apportionment,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 販促品（割引率) reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemDiscountRate = salesCartInfo?.items?.[1];
          return {
            barcode: salesItemDiscountRate?.barcode,
            totalStatementAmount: salesItemDiscountRate?.total_statement_amount,
            quantity: salesItemDiscountRate?.quantity,
            subtotalDiscountApportionment: salesItemDiscountRate?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const refundItemDiscountRate = res.result?.cartinfo?.items?.[1];
          return {
            barcode: refundItemDiscountRate?.barcode,
            totalStatementAmount: refundItemDiscountRate?.total_statement_amount,
            quantity: refundItemDiscountRate?.quantity,
            subtotalDiscountApportionment: refundItemDiscountRate?.subtotal_discount_apportionment,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 販促品（価格) reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemPriceBefore = salesCartInfo?.items?.[2];
          const salesItemPriceAfter = salesCartInfo?.items?.[3];
          return {
            barcodeItemPriceBefore: salesItemPriceBefore?.barcode,
            totalStatementAmountBefore: salesItemPriceBefore?.total_statement_amount,
            quantityItemPriceBefore: salesItemPriceBefore?.quantity,
            subtotalDiscountApportionmentBefore: salesItemPriceBefore?.subtotal_discount_apportionment,
            barcodeItemPriceAfter: salesItemPriceAfter?.barcode,
            totalStatementAmountAfter: salesItemPriceAfter?.total_statement_amount,
            quantityItemPriceAfter: salesItemPriceAfter?.quantity,
            subtotalDiscountApportionmentAfter: salesItemPriceAfter?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const refundItemPriceBefore = res.result?.cartinfo?.items?.[2];
          const refundItemPriceAfter = res.result?.cartinfo?.items?.[3];
          return {
            barcodeItemPriceBefore: refundItemPriceBefore?.barcode,
            totalStatementAmountBefore: refundItemPriceBefore?.total_statement_amount,
            quantityItemPriceBefore: refundItemPriceBefore?.quantity,
            subtotalDiscountApportionmentBefore: refundItemPriceBefore?.subtotal_discount_apportionment,
            barcodeItemPriceAfter: refundItemPriceAfter?.barcode,
            totalStatementAmountAfter: refundItemPriceAfter?.total_statement_amount,
            quantityItemPriceAfter: refundItemPriceAfter?.quantity,
            subtotalDiscountApportionmentAfter: refundItemPriceAfter?.subtotal_discount_apportionment,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 非販促品 reflects the correct refunded amount and quantity",
        expected: () => {
          const salesItemNonPromo = salesCartInfo?.items?.[4];
          return {
            barcode: salesItemNonPromo?.barcode,
            totalStatementAmount: salesItemNonPromo?.total_statement_amount,
            quantity: salesItemNonPromo?.quantity,
            subtotalDiscountApportionment: salesItemNonPromo?.subtotal_discount_apportionment,
          };
        },
        actual: (res) => {
          const itemNonPromo = res.result?.cartinfo?.items?.[4];
          return {
            barcode: itemNonPromo?.barcode,
            totalStatementAmount: itemNonPromo?.total_statement_amount,
            quantity: itemNonPromo?.quantity,
            subtotalDiscountApportionment: itemNonPromo?.subtotal_discount_apportionment,
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
        expected: {
          totalBalanceAmount: 0,
          paymentPaidAmount : salesCartInfo?.total_balance_amount,
          voidPaymentPaidAmount : salesCartInfo?.total_balance_amount,
        },
        actual: (res) => {
          const payment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paymentPaidAmount : payment?.paid_amount,
            voidPaymentPaidAmount : voidPayment?.paid_amount,
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
