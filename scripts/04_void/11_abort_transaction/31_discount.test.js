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
 * @function 単品値引
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.SINGLE_ITEM_DISCOUNT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 単品値引の売上取引が誤打訂正の途中で中断できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 4 | 通常商品操作値引 | `/sales/cart/unitdiscount` |
 * | 5 | 小計 | `/sales/subtotal` |
 * | 6 | 支払登録 | `/sales/addpayment` |
 * | 7 | 取引完了 | `/sales/end` |
 * | 8 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~7の取引（売上）のレシートをスキャン | - |
 * | 9 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_015で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.NONPLU商品: 0445000701007
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_015 にて検証済み）
 * * #### 4. 通常商品操作値引 `/sales/cart/unitdiscount`
 * * \- 通常商品の unit_discount_amount を取得
 * * \- total_balance_amount を取得
 * * #### 8. 【誤打訂正】取引開始 `/void/begin`
 * * \- 通常商品の操作値引金額が販売取引の操作値引金額と一致することを確認
 * * * \+ unit_discount_amount = sales.unit_discount_amount
 * * \- 合計金額が販売取引の金額と一致することを確認
 * * * \+ total_balance_amount = sales.total_balance_amount
 * * #### 9. 【誤打訂正】取引中断 `/void/abort`
 * * \- 中断成功および receipt_no が付与されていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041131001_AbortUnitDiscount() {
  group("TC_041131001 単品値引", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT, "通常商品操作値引"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    // Test data
    const discountType = "2"; // Indicates that the total amount will be deducted directly from manual import (値引額)
    const discountValue = 40; // Manual import discount amount

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

    const salesCartInfo = TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      discountType,
      discountValue,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const regularProd = salesCartInfo?.items?.find(q => q.item_cd === PROD.REGULAR);
    const unitDiscountAmount = regularProd?.unit_discount_amount;

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]);

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
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the unit discount amount of 通常商品 equal the unit discount amount in sales transaction",
        expected: unitDiscountAmount,
        actual: (res) => {
          const regularProdVoid = res.result?.cartinfo?.items?.find(q => q.item_cd === PROD.REGULAR);
          return regularProdVoid?.unit_discount_amount;
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
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

/**
 * @function 小計値引
 * @memberof 誤打訂正.誤打訂正中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.MISPRINT_CORRECTION}
 * {@link TAGS.MISPRINT_CORRECTION_CANCELED}
 * {@link TAGS.SUBTOTAL_MANUAL_REDUCTION}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 小計値引の売上取引が誤打訂正の途中で中断できる。
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
 * | 8 | 【誤打訂正】取引開始 | `/void/begin` |
 * | - | → 上記1~6の取引（売上）のレシートをスキャン | - |
 * | 9 | 【誤打訂正】取引中断 | `/void/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_016で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.単品値引商品: 2099998000039
 * * 2.通常商品: 4500000000121
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_016 にて検証済み）
 * * #### 5. 小計値引ボタンを押下し値引金額入力 `/sales/cart/subtotaldiscount`
 * * \- 単品値引商品・通常商品の operation_subtotal_discounts_applied.total_amount を取得
 * * \- operation_subtotal_discount.subtotal_discount_amount を取得
 * * \- total_balance_amount を取得
 * * #### 6. 【誤打訂正】取引開始 `/void/begin`
 * * \- 合計金額が販売取引の金額と一致することを確認
 * * * \+ total_balance_amount = sales.total_balance_amount
 * * \- 小計値引金額が販売取引の小計値引金額と一致することを確認
 * * * \+ operation_subtotal_discount.subtotal_discount_amount = sales.operation_subtotal_discount.subtotal_discount_amount
 * * \- 各商品の小計値引適用金額が販売取引の小計値引金額と一致することを確認
 * *  単品値引商品.operation_subtotal_discounts_applied.total_amount = sales.単品値引商品.operation_subtotal_discounts_applied.total_amount
 * * #### 9. 【誤打訂正】取引中断 `/void/abort`
 * * \- 中断成功および receipt_no が付与されていることを確認
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_041131002_AbortSubtotalDiscount() {
  group("TC_041131002 小計値引", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeSingleDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "単品値引商品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      subtotalDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_SUBTOTAL_DISCOUNT),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      voidBegin: CommonFunction.getFullDesc(ENDPOINT.VOID_BEGIN),
      voidAbort: CommonFunction.getFullDesc(ENDPOINT.VOID_ABORT),
    };

    // Test data
    const discountType = "2"; // Indicates that the total amount will be deducted directly from manual import (値引額)
    const discountValue = 40; // Manual import discount amount

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

    const singleDiscountProd = salesCartInfo?.items?.find(q => q.item_cd === PROD.SINGLE_DISCOUNT);
    const singleDiscountTotalAmount = singleDiscountProd?.statement_amounts?.operation_subtotal_discounts_applied?.total_amount;
    const regularProd = salesCartInfo?.items?.find(q => q.item_cd === PROD.REGULAR);
    const regularDiscountTotalAmount = regularProd?.statement_amounts?.operation_subtotal_discounts_applied?.total_amount;
    const subtotalDiscountAmount = salesCartInfo?.operation_subtotal_discount?.subtotal_discount_amount;

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
        name: "Verify the subtotal discounts equal the subtotal discounts in sales transaction",
        expected: subtotalDiscountAmount,
        actual: (res) => res.result?.cartinfo?.operation_subtotal_discount?.subtotal_discount_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify operation subtotal discounts applied to each item equal the subtotal discount in the sales transaction",
        expected: {
          singleDiscount: singleDiscountTotalAmount,
          regularDiscount: regularDiscountTotalAmount,
        },
        actual: (res) => {
          const voidSingleDiscountProd = res.result?.cartinfo?.items?.find(q => q.item_cd === PROD.SINGLE_DISCOUNT);
          const voidSingleDiscountTotalAmount = voidSingleDiscountProd?.statement_amounts?.operation_subtotal_discounts_applied?.total_amount;
          const voidRegularProd = res.result?.cartinfo?.items?.find(q => q.item_cd === PROD.REGULAR);
          const voidRegularDiscountTotalAmount = voidRegularProd?.statement_amounts?.operation_subtotal_discounts_applied?.total_amount;
          return {
            singleDiscount: voidSingleDiscountTotalAmount,
            regularDiscount: voidRegularDiscountTotalAmount,
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
