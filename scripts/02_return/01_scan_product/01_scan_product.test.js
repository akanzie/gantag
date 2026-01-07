import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { Formular } from "../../../common/formular.js";
import { COUPON } from "../../../common/constant/coupon.js";
import { CARD } from "../../../common/constant/card.js";
import { PROMOTION_POINT } from "../../../common/constant/promotion_point.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function レシート返品の全商品返品
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 売り上げた商品がレシート返品で全商品返品ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【返品】取引開始 | `/refund/begin` |
 * | 8 | 【返品】小計 | `/refund/subtotal` |
 * | 9 | 【返品】支払登録 | `/refund/addpayment` |
 * | 10 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 売上取引は既にTC_001に検証済み
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品：4500000000121
 * * 2. NONPLU商品：0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 4.小計 `/sales/subtotal`
 * * \- カートInfoに　以下が正しいか確認
 * * * \+ total_sales_amount = cartinfo.total_sales_amount
 * * * \+ total_balance_amount = cartinfo.total_balance_amount
 * * #### 8.【返品】小計 `/refund/subtotal`
 * * \- total_balance_amountは合計金額であるか確認
 * * * \+ 通常商品 has price 400, tax 8%
 * * * \+ NONPLU商品 has price 100, tax 8%
 * * \->合計金額 = items[0].unit_price + items[1].unit_price = 400 + 100 = 500
 * * \-> 税額 = (items[0].unit_price x  items[0].tax_rate / 100)+ (items[1].unit_price x  items[1].tax_rate / 100) = (400 x 8%) + (100 x 8%) = 40
 * * * \+ total_balance_amount = 合計金額 + 税額 = 500 + 40 = 540 (Step 4のtotal_balance_amountに等しい)
 * * #### 9.【返品】支払登録 `/refund/addpayment`
 * * \- 返金額 　＝　 total_sales_amount　か確認
 * * * \+ void_payments constain paid_amount = total_paid_amount = total_sales_amount (step 4) = 540
 * * #### 10.【返品】取引完了 `/refund/end`
 * * \- レシートデータに "ご返金"のデータがある、及び paid_amount (Step 9のpaid_amount)があるか確認
 */
export function TC_020101001_RefundByReceiptProductNormal() {
  group("TC_020101001 レシート返品の全商品返品", () => {
    const step = {
      salesBegin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      salesSubtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      salesPayment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      salesEnd: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

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

    const salesSubtotalResponse = TestHelper.salesSubtotal(step.salesSubtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

    const totalBalanceAmountSales = salesSubtotalResponse.result?.cartinfo?.total_balance_amount;
    const totalSalesAmountSales = salesSubtotalResponse.result?.cartinfo?.total_sales_amount;

    TestHelper.salesAddPayment(step.salesPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount: totalBalanceAmountSales,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

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

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(q => q.paid_cd === PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount equal the amount in sales transaction",
        expected: totalBalanceAmountSales,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount is equal total sales amount",
        expected: totalSalesAmountSales,
        actual: (res) => res.result?.cartinfo?.void_payments?.[0]?.paid_amount,
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and paid amount",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          "ご返金",
          totalSalesAmountSales,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function 単品返品
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.CODE_INPUT}
 * {@link TAGS.SINGLE_ITEM}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 売り上げた商品が単品返品で指定した商品の返品ができる。
 * * * ・通常商品のみ返品ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | 通常商品スキャン | `/refund/cart/barcode` |
 * | 3 | 【返品】小計 | `/refund/subtotal` |
 * | 4 | 【返品】支払登録 | `/refund/addpayment` |
 * | 5 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 2. 通常商品スキャン `/refund/cart/barcode`
 * * \- カートInfoに 通常商品があるか確認:
 * * * \+ barcode: 4500000000121
 * * * \+ unit_price: 400
 * * * \+ display_unit_price: 400
 * * * \+ tax_rate: 8
 * * #### 3.【返品】小計 `/refund/subtotal`
 * * 以下が正しいか確認
 * * \- Confirm total_sales_amount : 432 = 400+400*8%
 * * #### 5.【返品】取引完了 `/refund/end`
 * * \-レシートデータに "ご返金"があるか確認
 * * \- 返金額　＝　Step 3 で計算した total_sales_amount か確認する
 */
export function TC_020101003_RefundSingleItem() {
  group("TC_020101003 単品返品", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "通常商品スキャン"),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    // Specified in master
    const itemPrice = 400;
    const itemPriceTaxRate = 8;
    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType: 1, // Refund item
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.barcodeRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has 通常商品",
        expected: {
          barcode: PROD.REGULAR,
          unitPrice: itemPrice,
          displayUnitPrice: itemPrice,
          taxRate: itemPriceTaxRate,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.[0];
          return {
            barcode: item?.barcode,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
            taxRate: item?.tax_rate,
          };
        },
      }),
    ]);

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalBalanceAmount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain information: ご返金 and refund amount",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          "ご返金",
          totalBalanceAmount,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function 単品返品
（通常商品）
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * ### テスト観点
 * * 前提：
 * * 通常商品での単品返品を行う
 * * テスト観点：
 * * 単品返品で指定した「通常商品」が返品できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | 通常商品スキャン | `/refund/cart/barcode` |
 * | 3 | 【返品】小計 | `/refund/subtotal` |
 * | 4 | 【返品】支払登録 | `/refund/addpayment` |
 * | 5 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 通常商品: 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/refund/subtotal`
 * * \- カート情報に通常商品が含まれていることを確認
 * * * \+ 通常商品 barcode: 4500000000121
 * * \- 合計残高金額を以下の計算式で確認
 * * * \+ total_balance_amount = items[0].unit_price + items[0].unit_price × (items[0].tax_rate / 100)
 * * * \= 400 + 400 × 8% = 432
 * * #### 4. 支払登録 `/refund/addpayment`
 * * \- 誤打訂正支払方法が現金であることを確認
 * * * \+ total_balance_amount = 0
 * * * \+ void_payments に以下が含まれていること
 * * * * \. paid_cd = "0101"
 * * * * \. paid_name = "現金"
 * * * * \. paid_amount = total_balance_amount（Step 3 で算出した金額）
 * * #### 5. 取引完了 `/refund/end`
 * * \- レシートデータに誤打訂正支払方法：現金 が含まれていることを確認
 * * \- レシートデータに「ご返金」が含まれていることを確認
 * * \- レシートデータに返金額が 432（Step 3 の total_sales_amount）として表示されていることを確認
 */
export function TC_020101012_CashSingleRefund() {
  group("TC_020101012 単品返品（現金）", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundBarcodeRegular: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "通常商品スキャン"),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType: 1, // Refund single item (1: 単品返品)
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.refundBarcodeRegular, {
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

    const totalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info contains 通常商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalBalanceAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payment method is 現金",
        expected: {
          totalBalanceAmount: 0,
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_NAME,
          paidAmount: totalBalanceAmount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data contains ご返金, refund amount, void payment method 現金",
        expected: true,
        actual: (res) => {
          // Convert number to string currency
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalBalanceAmount);
          return CommonFunction.checkReceiptData([
            "ご返金",
            stringTotalPaidAmount,
            PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_NAME,
          ], res.result?.receipts);
        },
      }),
    ]);
  });
}

/**
 * @function 単品返品
（値引JAN）
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.CLOSEOUT_JAN}
 * {@link TAGS.CODE_INPUT}
 * {@link TAGS.SPECIFY_DISCOUNT_RATE}
 * {@link TAGS.SINGLE_ITEM}
 * ### テスト観点
 * * 前提：
 * * 値引JAN-割引での単品返品を行う
 * * テスト観点：
 * * 値引JAN-割引で単品返品できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | 値引JAN-割引スキャン | `/refund/cart/barcode` |
 * | 3 | 【返品】小計 | `/refund/subtotal` |
 * | 4 | 【返品】支払登録 | `/refund/addpayment` |
 * | 5 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 値引JAN-割引: 09450000000003210400
 * 
 * ---
 * ### 期待結果
 * * #### 2. 値引JAN-割引スキャン `/refund/cart/barcode`
 * * \- cartinfo に 値引JAN-割引 が含まれていることを確認する
 * * * \+ barcode: 4500000000032（元バーコード → 09450000000003210400 から算出）
 * * * \+ unit_discount_detail_list.discount_rate: 40（元バーコード → 09450000000003210400 から算出）
 * * * \+ unit_price: 300
 * * * \+ display_unit_price = unit_price − (unit_price × discount_rate / 100)
 * * * \= 300 − (300 × 40 / 100) = 180
 * * #### 3. 【返品】小計 `/refund/subtotal`
 * * \- total_sales_amount を確認する
 * * * \+ tax = display_unit_price × tax_rate% = 180 × 8 / 100 = 14（切り捨て）
 * * * \+ total_sales_amount = display_unit_price + tax = 180 + 14 = 194
 * * #### 4. 【返品】支払登録 `/refund/addpayment`
 * * \- 返品支払方法が 現金 であることを確認する
 * * * \+ total_balance_amount = 0
 * * * \+ void_payments に以下が含まれること
 * * * * \.paid_cd = "0101"
 * * * * \.paid_name = "現金"
 * * * * \.paid_amount = total_sales_amount（step 3 より）
 * * #### 5. 【返品】取引完了 `/refund/end`
 * * \- レシート情報に「ご返金」が含まれていることを確認する
 * * \- レシートに返金金額（step 3 の total_sales_amount = 194）が表示されていることを確認する
 */
export function TC_020101004_SingleProductJANRefund() {
  group("TC_020101004 単品返品（値引JAN）", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundBarcodeDiscountPercent: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "値引JAN-割引スキャン"),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const discountPercentObj = CommonFunction.createObjectFromDiscountRateProd(PROD.DISCOUNT_PERCENT);
    const discountPercentUnitPrice = 300; // Specified in master

    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType: 1, // Refund single item (1: 単品返品)
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.refundBarcodeDiscountPercent, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DISCOUNT_PERCENT,
          scan_data_type: "Code128",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that cart info contains 値引JAN-割引",
        expected: {
          barcode: discountPercentObj.barcode,
          discountRate: discountPercentObj.discountRate,
          unitPrice: discountPercentUnitPrice,
          displayUnitPrice: discountPercentUnitPrice - (discountPercentUnitPrice * discountPercentObj.discountRate / 100),
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === discountPercentObj.barcode);
          const unitDiscountDetail = item?.unit_discount_detail_list?.find(unit => unit.barcode_1 === PROD.DISCOUNT_PERCENT);
          return {
            barcode: item?.barcode,
            discountRate: unitDiscountDetail?.discount_rate,
            unitPrice: item?.unit_price,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
    ]);

    const totalSalesAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total_sales_amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_sales_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalSalesAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: " Verify that the void payment method is 現金",
        expected: {
          totalBalanceAmount: 0,
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_NAME,
          paidAmount: totalSalesAmount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data contains information: ご返金 and paid amount",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalSalesAmount);
          return CommonFunction.checkReceiptData([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts);
        },
      }),
    ]);
  });
}

/**
 * @function 単品返品
（株主優待）
 * @memberof 返品
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.RECEIPT_PRINTING}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.CODE_INPUT}
 * {@link TAGS.RETURN_RECEIPT}
 * {@link TAGS.SHAREHOLDER_BENEFITS}
 * {@link TAGS.SINGLE_ITEM}
 * ### テスト観点
 * * 前提：
 * * 株主優待割許可商品(対象)の単品返品を行う
 * * テスト観点：
 * * 株主優待割許可商品(対象)の単品返品ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | 株主優待割許可商品(対象)スキャン | `/refund/cart/barcode` |
 * | 3 | 株主優待バーコードスキャン | - |
 * | 4 | 【返品】小計 | `/refund/subtotal` |
 * | 5 | 【返品】支払登録 | `/refund/addpayment` |
 * | 6 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. 株主優待割許可商品(対象): 4931290077013
 * * 2. 株主優待 : K20180900"
 * 
 * ---
 * ### 期待結果
 * * #### 2. 株主優待割許可商品(対象)スキャン `/refund/cart/barcode`
 * * \- cartinfo に 株主優待割許可商品(対象) が含まれていることを確認する
 * * * \+ barcode: 4931290077013
 * * * \+ display_unit_price: 198
 * * 3. 株主優待バーコードスキャン
 * * \- 株主優待割引が適用されていることを確認する
 * * * \+ subtotal_discount_cd: 2004
 * * * \+ subtotal_discount_name: 株主優待
 * * * \+ subtotal_discount_rate: 5
 * * #### 4. 【返品】小計 `/refund/subtotal`
 * * \- 株主優待割引が適用されていることを確認する
 * * * \+ subtotal_discounts.target_items に [0] が含まれている
 * * \- 株主優待割引金額を確認する
 * * * \+ totalShBDiscountAmount = display_unit_price × subtotal_discount_rate / 100
 * * * \= 198 × 5 / 100 = 9（切り捨て）
 * * \- total_sales_amount を確認する
 * * * \+ tax = display_unit_price × tax_rate% = 189 × 8 / 100 = 15（切り捨て）
 * * * \+ total_sales_amount = display_unit_price + tax = 189 + 15 = 204
 * * #### 5. 【返品】支払登録 `/refund/addpayment`
 * * \- 返品支払方法が 現金 であることを確認する
 * * * \+ total_balance_amount = 0
 * * * \+ void_payments に以下が含まれること
 * * * * \.paid_cd = "0101"
 * * * * \.paid_name = "現金"
 * * * * \.paid_amount = total_sales_amount（step 4 より）
 * * #### 6. 【返品】取引完了 `/refund/end`
 * * \- レシート情報に「ご返金」が含まれていることを確認する
 * * \- レシートに返金金額（step 4 の total_sales_amount = 204）が表示されていることを確認する
 */
export function TC_020101005_ShareholderBenefitSingleRefund() {
  group("TC_020101005 単品返品（株主優待）", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundBarcodeShareholderDiscountAllowed: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "株主優待割許可商品(対象)スキャン"),
      refundBarcodeShareholderBenefits: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "株主優待バーコードスキャン"),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const shareholderBenefitPrice = 198; // Test data
    const shareholderRoundingMethod = 2; // Specified in master, RoundingMethod Type is rounding down

    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType: 1, // Refund single item (1: 単品返品)
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.refundBarcodeShareholderDiscountAllowed, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that cart info contains 株主優待割許可商品(対象)",
        expected: {
          barcode: PROD.SHAREHOLDER_DISCOUNT_ALLOWED,
          displayUnitPrice: shareholderBenefitPrice,
        },
        actual: (res) => {
          const item = res.result?.cartinfo?.items?.find(item => item.barcode === PROD.SHAREHOLDER_DISCOUNT_ALLOWED);
          return {
            barcode: item?.barcode,
            displayUnitPrice: item?.display_unit_price,
          };
        },
      }),
    ]);

    TestHelper.refundCartBarcode(step.refundBarcodeShareholderBenefits, {
      cartNo,
      barcodes: [
        {
          barcode: COUPON.SHAREHOLDER_BENEFITS.CD,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that shareholder benefit discount has been applied",
        expected: {
          subtotalDiscountCd: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD,
          subtotalDiscountName: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_NAME,
          subtotalDiscountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
        },
        actual: (res) => {
          const subTotalDiscounts = res.result?.cartinfo?.subtotal_discounts?.find(s => s.subtotal_discount_cd === COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD);
          return {
            subtotalDiscountCd: subTotalDiscounts?.subtotal_discount_cd,
            subtotalDiscountName: subTotalDiscounts?.subtotal_discount_name,
            subtotalDiscountRate: subTotalDiscounts?.subtotal_discount_rate,
          };
        },
      }),
    ]);

    const totalSalesAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that the shareholder benefit discount is applied",
        expected: true,
        actual: (res) => {
          const targetItems = res.result?.cartinfo?.subtotal_discounts?.find(s => s.subtotal_discount_cd === COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD)?.target_items;
          const shareholderDiscountAllowedIdx = res.result?.cartinfo?.items?.findIndex(i => i.item_cd === PROD.SHAREHOLDER_DISCOUNT_ALLOWED);
          return targetItems?.includes(shareholderDiscountAllowedIdx);
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify shareholder benefit discount amount",
        expected: (res) => {
          return Formular.calcShareHolderBenefitDiscountAmount({
            items: res.result?.cartinfo?.items,
            discountRate: COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_RATE,
            roundMethodType: shareholderRoundingMethod,
          });
        },
        actual: (res) => res.result?.cartinfo?.subtotal_discounts?.find(s => s.subtotal_discount_cd === COUPON.SHAREHOLDER_BENEFITS.DISCOUNT_CD)?.subtotal_discount_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_sales_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalSalesAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payment method is 現金",
        expected: {
          totalBalanceAmount: 0,
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_NAME,
          paidAmount: totalSalesAmount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that receipt contains ご返金 and refund amount",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalSalesAmount);
          return CommonFunction.checkReceiptData([
            "ご返金",
            stringTotalPaidAmount,
          ], res.result?.receipts);
        },
      }),
    ]);
  });
}

/**
 * @function 単品返品（ポイント〇倍デー）
 * @memberof 返品.販売促進（企画販売）
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.POINT}
 * {@link TAGS.RETURN}
 * {@link TAGS.AOCA_POINTS}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.SALES_PROMOTION_PLANNED_SALES}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * {@link TAGS.POINT_MULTIPLIER_UP}
 * {@link TAGS.DAY_OF_THE_WEEK}
 * ### テスト観点
 * * 前提：
 * * ポイント倍対象商品の単品返品を行う（Aocaカード利用）
 * * テスト観点：
 * * ポイント倍対象商品の単品返品ができる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | Aocaカードスキャン | `/refund/cart/barcode` |
 * | 3 | ポイント倍対象商品スキャン | `/refund/cart/barcode` |
 * | 4 | 【返品】小計 | `/refund/subtotal` |
 * | 5 | 【返品】支払登録 | `/refund/addpayment` |
 * | 6 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. ポイント倍対象商品:  4520230413100
 * *  購入日にポイント5倍の5x_point_alldayの設定
 * * * \+  saturday_promotion_enabled_flgの値： 1
 * * point_standard_rate: 5
 * * 2. プロモー 基準ポイント_Aoca: 
 * * * * \+ point_standard_amount: 100
 * * * * \+ add_standard_point: 1
 * * (設定：100円購入ごとで+1ポイント)
 * 
 * ---
 * ### 期待結果
 * * #### 2. Aocaカードスキャン `/refund/cart/barcode`
 * * \- Aocaカードの顧客情報が含まれていることを確認する:
 * * * \+ customer_cd: 8090227000000006
 * * * \+ point_card_name: "Aoca"
 * * #### 3. ポイント倍対象商品スキャン `/refund/cart/barcode`
 * * \- cart info にポイント倍対象商品が含まれていることを確認する:
 * * * \+ barcode: 4520230413100
 * * \- total_sales_amount_without_tax = display_unit_price × quantity = 200 × 1 = 200 となること
 * * \- ポイント倍対象商品がポイント付与対象であることを確認する:
 * * * \+ total_add_point = total_sales_amount_without_tax / point_standard_amount × add_standard_point = 200 / 100 × 1 = 2 （切り捨て）
 * * * \+ 基準ポイント_Aoca:
 * * \- add_point = 2（切り捨て）
 * * \- promotion_cd: 0100
 * * \- promotion_name: 基準ポイント_Aoca
 * * #### 4. 【返品】小計 `/refund/subtotal`
 * * \- 売上合計金額を確認する
 * * * * \. tax = 200 × 8 / 100 = 16（切り捨て）
 * * * * \. total_sales_amount = 200 + 16 = 216
 * * #### 5. 【返品】支払登録 `/refund/addpayment`
 * * \- 取消支払方法が現金であることを確認する:
 * * * \+ total_balance_amount = 0
 * * * \+ void_payments に以下が含まれていること:
 * * * * \.paid_cd = "0101"
 * * * * \.paid_name = "現金"
 * * * * \.paid_amount = total_sales_amount（step 4 の値）
 * * #### 6. 【返品】取引完了 `/refund/end`
 * * \- レシートデータに "ご返金" が含まれていることを確認する
 * * \- 返金金額 = 216（step 4 の total_sales_amount）が含まれていること
 * * \- 取消ポイント = 2p（step 3 の total_add_point）が含まれていること
 */
export function TC_020101006_BonusPointsDaySingleRefund() {
  group("TC_020101006 単品返品（ポイント〇倍デー）", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundBarcodeAokiPrepaid: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "Aocaカードスキャン"),
      refundBarcodeMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "ポイント倍対象商品スキャン"),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType: 1, // Refund single item (1: 単品返品)
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.refundBarcodeAokiPrepaid, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.AOKI_PREPAID.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify customer's Aoca card info",
        expected: {
          customerCd: CARD.AOKI_PREPAID.CODE,
          pointCardName: CARD.AOKI_PREPAID.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ]);

    const totalAddPoint = TestHelper.refundCartBarcode(step.refundBarcodeMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.MULTIPLY_POINTS,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info contains ポイント倍対象商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.MULTIPLY_POINTS,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.find(item => item.barcode === PROD.MULTIPLY_POINTS)),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント倍対象商品 earns points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.AOCA.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.AOCA.ADD_STANDARD_POINT,
          });
          return {
            totalAddPoint: standardPointExpected,
            aocaAddPoint: standardPointExpected,
            aocaPromotionCd: PROMOTION_POINT.AOCA.CD,
            aocaPromotionName: PROMOTION_POINT.AOCA.NAME,
          };
        },
        actual: (res) => {
          const aocaPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION_POINT.AOCA.CD);
          return {
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
            aocaAddPoint: aocaPointDetail?.add_point,
            aocaPromotionCd: aocaPointDetail?.promotion_cd,
            aocaPromotionName: aocaPointDetail?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

    const totalSalesAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_sales_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalSalesAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payment method is 現金",
        expected: {
          totalBalanceAmount: 0,
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_NAME,
          paidAmount: totalSalesAmount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt contains ご返金, refund amount, reversed points earned",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalSalesAmount);
          return CommonFunction.checkReceiptData([
            "ご返金",
            stringTotalPaidAmount,
            `-${totalAddPoint}p`,
          ], res.result?.receipts);
        },
      }),
    ]);
  });
}

/**
 * @function 単品返品（ｄポイント）
 * @memberof 返品.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.POINT}
 * {@link TAGS.RETURN}
 * {@link TAGS.D_POINT}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.ADDITION_AND_SUBTRACTION}
 * ### テスト観点
 * * 前提：
 * * ポイント対象商品（上位参照）の単品返品を行う（dポイントカード利用）
 * * テスト観点：
 * * ポイント対象商品（上位参照）の単品返品ができる。
 * * \-----
 * * Q&ANo.138により不具合である。
 * * 背景：dポイントを使用した販売取引後、単品返品を実施する。現在、返品時にrefund`/cart/barcode`のステップでdポイントカードのスキャンがシステム上でできない。
 * * 川上さんの回答：不具合の可能性があるので確認します（確認は11`/17`週になりそうです）
 * * 単品返品でもdポイントカードのスキャンはできるべきなので、シナリオはその想定で作成をお願いいたします
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 【返品】取引開始 | `/refund/begin` |
 * | 2 | dポイントカードスキャン | `/refund/cart/barcode` |
 * | 3 | ポイント対象商品（上位参照）スキャン | `/refund/cart/barcode` |
 * | 4 | 【返品】小計 | `/refund/subtotal` |
 * | 5 | 【返品】支払登録 | `/refund/addpayment` |
 * | 6 | 【返品】取引完了 | `/refund/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1. dポイント: 100000006699030
 * * 2. ポイント対象商品（上位参照）: 4500000000056
 * * 3. プロモー 基準ポイント_dポイント:
 * * * * \+ point_standard_amount: 200
 * * * * \+ add_standard_point: 1
 * * (設定：100円購入ごとで+1ポイント)
 * 
 * ---
 * ### 期待結果
 * * #### 2. dポイントカードスキャン `/refund/cart/barcode`
 * * \- dポイントカードの顧客情報が含まれていることを確認する:
 * * * \+ customer_cd: 100000006699030
 * * * \+ point_card_name: "dポイントカード"
 * * #### 3. ポイント対象商品（上位参照） `/refund/cart/barcode`
 * * \- cart info にポイント対象商品（上位参照）が含まれていることを確認する:
 * * * \+ barcode: 4500000000056
 * * \- 該当商品がポイント付与対象であることを確認する:
 * * * \+ total_sales_amount_without_tax = (500 − 100) × 1 = 400
 * * * \+ total_add_point = 400 / 200 × 1 = 2（切り捨て）
 * * * \+ planning_add_points.point_detail.add_point = 2（切り捨て）
 * * * \+ planning_add_points.point_detail.promotion_cd = "0200"
 * * * \+ planning_add_points.point_detail.promotion_name = "基準ポイント_dポイント"
 * * #### 4. 【返品】小計 `/refund/subtotal`
 * * \- 売上合計金額を確認する
 * * * * \. tax = 400 × 8 / 100 = 32（切り捨て）
 * * * * \. total_sales_amount = 400 + 32 = 432
 * * #### 5. 【返品】支払登録 `/refund/addpayment`
 * * \- 取消支払方法が現金であることを確認する:
 * * * \+ total_balance_amount = 0
 * * * \+ void_payments に以下が含まれていること:
 * * * * \.paid_cd = "0101"
 * * * * \.paid_name = "現金"
 * * * * \.paid_amount = total_sales_amount（step 4 の値）
 * * #### 6. 【返品】取引完了 `/refund/end`
 * * \- レシートデータに "ご返金" が含まれていることを確認する
 * * \- 返金金額 = 432（step 4 の total_sales_amount）が含まれていること
 * * \- 返金ポイント = 2p（step 3 の total_add_point）が含まれていること
 */
export function TC_020101007_DPointSingleRefund() {
  group("TC_020101007 単品返品（ｄポイント）", () => {
    const step = {
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundBarcodeDPoint: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "dポイントカードスキャン"),
      refundBarcodeMultiplyPoints: CommonFunction.getFullDesc(ENDPOINT.REFUND_CART_BARCODE, "ポイント対象商品（上位参照）スキャン"),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundEnd: CommonFunction.getFullDesc(ENDPOINT.REFUND_END),
    };

    const cartNo = TestHelper.refundBegin(step.refundBegin, {
      refundType: 1, // Refund single item (1: 単品返品)
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundCartBarcode(step.refundBarcodeDPoint, {
      cartNo,
      barcodes: [
        {
          barcode: CARD.DPOINT.CODE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that cart info contains dポイントカード",
        expected: {
          customerCd: CARD.DPOINT.CODE,
          pointCardName: CARD.DPOINT.NAME,
        },
        actual: (res) => {
          return {
            customerCd: res.result?.cartinfo?.customer?.customer_cd,
            pointCardName: res.result?.cartinfo?.customer?.point_card_name,
          };
        },
      }),
    ]);

    const totalAddPoint = TestHelper.refundCartBarcode(step.refundBarcodeMultiplyPoints, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.POINT_TARGET_REFER_UPPER,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info contains ポイント対象商品（上位参照）",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.POINT_TARGET_REFER_UPPER,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount without tax",
        expected: (res) => Formular.calcPriceAfterDiscounts(res.result?.cartinfo?.items?.find(item => item.barcode === PROD.POINT_TARGET_REFER_UPPER)),
        actual: (res) => res.result?.cartinfo?.total_sales_amount_without_tax,
      }),
      CHECK.createEqualsCheck({
        name: "Verify ポイント対象商品（上位参照）earns points",
        expected: (res) => {
          const standardPointExpected = Formular.calcPointItem({
            cartinfo: res.result?.cartinfo,
            pointStandardAmount: PROMOTION_POINT.DPOINT.POINT_STANDARD_AMOUNT,
            addStandardPoint: PROMOTION_POINT.DPOINT.ADD_STANDARD_POINT,
          });
          return {
            totalAddPoint: standardPointExpected,
            dPointAddPoint: standardPointExpected,
            dPointPromotionCd: PROMOTION_POINT.DPOINT.CD,
            dPointPromotionName: PROMOTION_POINT.DPOINT.NAME,
          };
        },
        actual: (res) => {
          const dPointDetail = res.result?.cartinfo?.customer?.planning_add_points?.point_detail?.find(p => p.promotion_cd === PROMOTION_POINT.DPOINT.CD);
          return {
            totalAddPoint: res.result?.cartinfo?.customer?.planning_add_points?.total_add_point,
            dPointAddPoint: dPointDetail?.add_point,
            dPointPromotionCd: dPointDetail?.promotion_cd,
            dPointPromotionName: dPointDetail?.promotion_name,
          };
        },
      }),
    ]).result?.cartinfo?.customer?.planning_add_points?.total_add_point;

    const totalSalesAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total sales amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_sales_amount,
      }),
    ]).result?.cartinfo?.total_sales_amount;

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      paidAmount: totalSalesAmount,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify void payment method is 現金",
        expected: {
          totalBalanceAmount: 0,
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_NAME,
          paidAmount: totalSalesAmount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundEnd(step.refundEnd, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt contains ご返金, refund amount, reversed points earned",
        expected: true,
        actual: (res) => {
          const stringTotalPaidAmount = CommonFunction.convertToCurrency(totalSalesAmount);
          return CommonFunction.checkReceiptData([
            "ご返金",
            stringTotalPaidAmount,
            `-${totalAddPoint}p`,
          ], res.result?.receipts);
        },
      }),
    ]);
  });
}
