import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as PROD from "../../../common/constant/product.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { CARD } from "../../../common/constant/card.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 売上～返品の中止
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.TRADE_CALL}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * ### テスト観点
 * * レシート返品が途中で中止される
 * * * ・通常商品をスキャンする。
 * * * ・現金で支払い、売上取引が完了する。
 * * * ・売上取引完了後に、レシート返品を行う。
 * * * * →　売上取引のレシートをスキャンする
 * * * ・返品を中止する
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【返品】取引開始 | `/refund/begin` |
 * | 7 | 【返品】小計 | `/refund/subtotal` |
 * | 8 | 【返品】取引中断 | `/refund/abort` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品 : 4500000000121
 * 
 * ---
 * ### 期待結果
 * * #### 3. 小計 `/sales/subtotal`
 * * \- sales.cartinfoデータを取得する。
 * * #### 7. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認する。
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 8. 【返品】取引中断 `/refund/abort`
 * * \- 中断処理が正常に完了し、レシート番号が存在することを確認する。
 * * * \+ ステータス: 200
 * * * \+ receipt_no > 0
 */
export function TC_021334001_SalesCancellationOfReturns() {
  group("TC_021334001 売上～返品の中止", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount: salesCartInfo?.total_balance_amount,
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

    cartNo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo?.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify data has exist receipt no (receipt_no > 0)",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
}

/**
 * @function レシート返品
（単品値引）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.SINGLE_ITEM_DISCOUNT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 単品値引で売り上げた商品が、レシート返品の途中で中止できる。
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
 * | 8 | 【返品】取引開始 | `/refund/begin` |
 * | 9 | 【返品】小計 | `/refund/subtotal` |
 * | 10 | 【返品】支払登録 | `/refund/addpayment` |
 * | 11 | 【返品】取引中断 | `/refund/abort` |
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
 * * * データ取得（販売取引 TC_015 にて確認済み）
 * * #### 5. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * \- 通常商品アイテムの値引き額データ取得: sales.item[].unit_discount_amount
 * * * 返品データが販売取引と一致していることを確認
 * * #### 9.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * \- 通常商品の単品値引き額が販売取引の値引き額と一致していることを確認
 * * * \+ item[].unit_discount_amount = sales.item[].unit_discount_amount
 * * #### 11.【返品】取引中断 `/refund/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ Status: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334007_RefundAbortUnitDiscount() {
  group("TC_021334007 レシート返品（単品値引）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE,"通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE,"NONPLU商品スキャン"),
      unitDiscount: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_UNIT_DISCOUNT),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    // Test data
    const discountType = "2"; // Indicates that the total amount will be deducted directly from manual import (値引額)
    const discountValue = 40; // Manual import discount amount

    let cartNo = TestHelper.salesBegin(step.begin, {
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

    TestHelper.salesCartUnitDiscount(step.unitDiscount, {
      cartNo,
      discountType,
      discountValue,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const totalBalanceAmount = salesCartInfo?.total_balance_amount;
    const regularProd = salesCartInfo?.items?.find(q => q.barcode === PROD.REGULAR);
    const unitDiscountAmount = regularProd?.unit_discount_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
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

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: totalBalanceAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify unit discount amount of 通常商品 equal the amount in sales transaction",
        expected: unitDiscountAmount,
        actual: (res) => {
          const regularProd = res.result?.cartinfo?.items?.find(q => q.barcode === PROD.REGULAR);
          return regularProd?.unit_discount_amount;
        },
      }),
    ]);

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: payment?.paid_amount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
 * @function レシート返品
（小計値引）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.SUBTOTAL_MANUAL_REDUCTION}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 小計値引で売り上げた商品が、レシート返品の途中で中止できる。
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
 * | 11 | 【返品】取引中断 | `/refund/abort` |
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
 * * * データ取得（販売取引 TC_016 にて確認済み）
 * * #### 5. 小計値引ボタンを押下し値引金額入力 `/sales/cart/subtotaldiscount`
 * * \- sales.cartinfo のデータ取得
 * * \- sales.operation_subtotal_discount のデータ取得
 * * * 返品データが販売取引と一致していることを確認
 * * #### 9.【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * \- 小計値引が販売取引と一致していることを確認
 * * * * \. operation_subtotal_discount.subtotal_discount_cd = sales.operation_subtotal_discount.subtotal_discount_cd
 * * * * \. operation_subtotal_discount.subtotal_discount_name = sales.operation_subtotal_discount.subtotal_discount_name
 * * * * \. operation_subtotal_discount.subtotal_discount_amount = sales.operation_subtotal_discount.subtotal_discount_amount
 * * #### 11.【返品】取引中断 `/refund/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ Status: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334008_RefundAbortSubtotalDiscount() {
  group("TC_021334008 レシート返品（小計値引）", () => {
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
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    // Test data
    const discountType = "2"; // Indicates that the total amount will be deducted directly from manual import (値引額)
    const discountValue = 40; // Manual import discount amount

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
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
    const salesSubtotalDiscount = salesCartInfo?.operation_subtotal_discount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
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

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE);

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: totalBalanceAmount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify subtotal discount match the sales transaction",
        expected: {
          subtotalDiscountCd: salesSubtotalDiscount?.subtotal_discount_cd,
          subtotalDiscountName: salesSubtotalDiscount?.subtotal_discount_name,
          subtotalDiscountAmount: salesSubtotalDiscount?.subtotal_discount_amount,
        },
        actual: (res) => {
          const refundSubtotalDiscount = res.result?.cartinfo?.operation_subtotal_discount;
          return {
            subtotalDiscountCd: refundSubtotalDiscount?.subtotal_discount_cd,
            subtotalDiscountName: refundSubtotalDiscount?.subtotal_discount_name,
            subtotalDiscountAmount: refundSubtotalDiscount?.subtotal_discount_amount,
          };
        },
      }),
    ]);

    TestHelper.refundPayment(step.refundPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: payment?.paid_amount,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
 * @function レシート返品
（TMNプリペ）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.TMN_PREPAID}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * プリペバリュー利用で売り上げた商品が、レシート返品の途中で中止できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 0 | Aokiギフトカードが支払可能な金額にする | - |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | ポイント付与専用商品（対象外） スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品 スキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/tmn-prepaid/value` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【返品】取引開始 | `/refund/begin` |
 * | 8 | 【返品】小計 | `/refund/subtotal` |
 * | 9 | TMNプリペバリュー返金 | `/tmn-prepaid/refund` |
 * | 10 | 【返品】取引中断 | `/refund/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_101で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.ポイント付与専用商品（対象外）: 4911110703005
 * * 2.通常商品 : 4500000000121
 * * 3.Aocaギフトカード: 8308891100000030 (paid_code: 0996)
 * 
 * ---
 * ### 期待結果
 * * * データ取得（販売取引 TC_101 にて確認済み）
 * * #### 4. 小計 `/sales/subtotal`
 * * \- sales.cartinfo のデータ取得
 * * * AOKギフトカード支払いのデータ確認
 * * #### 5. 支払登録 `/tmn-prepaid/value`
 * * \- 支払い後、合計残高が 0 であることを確認
 * * * \+ total_balance_amount: 0
 * * \- カート情報に AOK ギフトカード支払いが含まれていることを確認
 * * * \+ AOK ギフトカード支払い（aoki_payment）の内容:
 * * * * \.paid_cd = "0996"
 * * * * \.paid_name = "ギフト"
 * * * * \.paid_amount = sales.cartinfo.total_balance_amount
 * * \- カート情報の支払い方法が1件のみであることを確認
 * * * \+ sales.cartinfo.payments.length = 1
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷され、支払い方法1件（ギフト）が記載されていることを確認
 * * * 返品取引のデータ確認
 * * #### 8. 【返品】小計 `/refund/subtotal`
 * * \- 合計金額が販売取引の金額と一致していることを確認
 * * * \+ total_balance_amount = sales.cartinfo.total_balance_amount
 * * #### 9. TMNプリペバリュー返金 `/tmn-prepaid/refund`
 * * \- 返金額が販売取引の支払い額と一致していることを確認
 * * * \+ void_payments に ギフト（Aoki ギフトカード）支払いが含まれること
 * * * * \. void_payments[].paid_cd = aoki_payment.paid_cd
 * * * * \. void_payments[].paid_name = aoki_payment.paid_name
 * * * * \. void_payments[].paid_amount = aoki_payment.paid_amount
 * * #### 10. 【返品】取引中断 `/refund/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ Status: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334004_RefundAbortAOKGiftCard() {
  group("TC_021334004 レシート返品（TMNプリペ）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodePointTarget: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "ポイント付与専用商品（対象外）スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, " 通常商品 スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      generatekey: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_CERTIFICATION),
      getBalance: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_GET_BALANCE),
      deposit: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_DEPOSIT),
      tmnPrepaidValue: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_VALUE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      tmnPrepaidRefund: CommonFunction.getFullDesc(ENDPOINT.TMN_PREPAID_REFUND),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    const cardNo = CARD.AOKI_GIFT.CODE;
    const paidCode = PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_CODE;
    const paidName = PAID_METHOD.TMN_PREPAID.PAID_ITEMS.TMN_PREPAID_GIFT_CARD.PAID_NAME;
    let aokiPayment = null;

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodePointTarget, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DEDICATED_POINT_GRANT_EXCLUDE,
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    TestHelper.tmnPrepaidCertification(step.generatekey, [
      CHECK.createStatusCodeCheck(),
    ]);

    // Ensure the amount can be paid by Aoki gift card
    const balance = TestHelper.tmnPrepaidGetBalance(step.getBalance, {
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.card_info?.value_amount_sum;

    if (balance < salesCartInfo.total_balance_amount) {
      TestHelper.tmnPrepaidDeposit(step.deposit, {
        cardNo,
        receiptNo: ENVIRONMENT.TMN_PREPAID_RECEIPT_NO,
        chargeValueAmount: salesCartInfo.total_balance_amount,
      }, [
        CHECK.createStatusCodeCheck(),
      ]);
    }

    TestHelper.tmnPrepaidValue(step.tmnPrepaidValue, {
      cartNo,
      paidCodes: [
        paidCode,
      ],
      paidAmount: salesCartInfo.total_balance_amount,
      cardNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount equals 0 after payment",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info has AOK gift card payment",
        expected: {
          paidCode,
          paidName,
          paidAmount: salesCartInfo.total_balance_amount,
        },
        actual: (res) => {
          aokiPayment = res.result?.cartinfo?.payments?.find(payment => payment.paid_cd === paidCode);
          return {
            paidCode: aokiPayment?.paid_cd,
            paidName: aokiPayment?.paid_name,
            paidAmount: aokiPayment?.paid_amount,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 1 payment method",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.payments?.length,
      }),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain Aoki gift card payment method",
        expected: true,
        actual: (res) => CommonFunction.checkReceiptData([
          paidName,
        ], res.result?.receipts),
      }),
    ]);

    sleep(3);

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesEndResponse.result?.receipt_no,
      businessDay: salesEndResponse.result?.business_day,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify total amount equal the amount in sales transaction",
        expected: salesCartInfo.total_balance_amount,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    TestHelper.tmnPrepaidRefund(step.tmnPrepaidRefund, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the refund amount equal the amount in sales transaction",
        expected: {
          paidCode: aokiPayment?.paid_cd,
          paidName: aokiPayment?.paid_name,
          paidAmount: aokiPayment?.paid_amount,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(payment => payment.paid_cd === aokiPayment?.paid_cd);
          return {
            paidCode: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
            paidAmount: voidPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
};

/**
 * @function レシート返品
（クレジット）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.CREDIT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * クレジット支払で売り上げた商品が、レシート返品の途中で中止できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 (クレジットカード ) | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * | 6 | 【返品】取引開始 | `/refund/begin` |
 * | 7 | 【返品】小計 | `/refund/subtotal` |
 * | 8 | 【返品】支払登録 | `/refund/addpayment` |
 * | 9 | 【返品】取引中断 | `/refund/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_104で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.クレジットカード 
 * 
 * ---
 * ### 期待結果
 * * #### 9.【返品】取引中断 `/refund/abort`
 * * \- 中断処理が正常終了し、レシート番号が採番されること
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334002_RefundAbortCreditCard() {
  group("TC_021334002 レシート返品（クレジット）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (クレジットカード)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundAddPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CREDIT.GROUP_CODE,
      paidCode: PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.CREDIT_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesEndResponse.result?.receipt_no,
      businessDay: salesEndResponse.result?.business_day,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CREDIT.PAID_ITEMS.CREDIT.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundAddPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
 * @function レシート返品
（電子マネー）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.ELECTRONIC_MONEY}
 * {@link TAGS.WAON}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 電子マネー支払で売り上げた商品が、レシート返品の途中で中止できる。
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
 * | 9 | 【返品】支払登録 | `/refund/addpayment` |
 * | 10 | 【返品】取引中断 | `/refund/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_103で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.NONPLU商品: 0445000701007
 * * 3.WAON
 * 
 * ---
 * ### 期待結果
 * * #### 10.【返品】取引中断 `/refund/abort`
 * * \- 中断処理が正常終了し、レシート番号が採番されること
 * * * \+ ステータス: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334003_RefundAbortWaon() {
  group("TC_021334003 レシート返品（電子マネー）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (WAON)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundAddPayment: CommonFunction.getFullDesc(ENDPOINT.REFUND_PAYMENT),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.E_MONEY.GROUP_CODE,
      paidCode: PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.WAON_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesEndResponse.result?.receipt_no,
      businessDay: salesEndResponse.result?.business_day,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    const refundCartInfo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    cartNo = refundCartInfo?.cart_no;
    const payment = refundCartInfo?.payments?.find(p => p.paid_cd === PAID_METHOD.E_MONEY.PAID_ITEMS.WAON.PAID_CODE);

    const refundTotalBalanceAmount = TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.refundPayment(step.refundAddPayment, {
      cartNo,
      paidGroupCode: payment?.paid_group_cd,
      paidCode: payment?.paid_cd,
      paidAmount: refundTotalBalanceAmount,
      details: payment?.details,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
 * @function レシート返品
（ｄポイント）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.D_POINT}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * ｄポイント支払で売り上げた商品が、レシート返品の途中で中止できる。
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
 * | 9 | 【返品】取引中断 | `/refund/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_101で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品: 4500000000121
 * * 2.dPoint: 100000006699030
 * 
 * ---
 * ### 期待結果
 * * #### 8.【dポイント】ポイント利用取消  `/dpoint/usepointcancel`
 * * \- カート情報に dポイント支払いが含まれていることを確認
 * * * \+ void_payments に dポイント支払いが含まれていること
 * * * * \. void_payments[].paid_group_cd = "0500"
 * * * * \. void_payments[].paid_cd = "0501"
 * * * * \. void_payments[].paid_name = "dポイント"
 * * #### 9.【返品】取引中断 `/refund/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ Status: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334005_RefundAbortDPoint() {
  group("TC_021334005 レシート返品（ｄポイント）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      dPointUsePoint: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      dPointUsePointCancel: CommonFunction.getFullDesc(ENDPOINT.DPOINT_USEPOINTCANCEL),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    let cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
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

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.dPointUsePoint(step.dPointUsePoint, {
      cartNo,
      pointUseAmount: totalBalanceAmount,
      memberId: CARD.DPOINT.CODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    const salesEndResponse = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    sleep(3);

    const receiptBarcode = CommonFunction.getReceiptBarcode({
      receiptNo: salesEndResponse.result?.receipt_no,
      businessDay: salesEndResponse.result?.business_day,
      barcodeStart: ENVIRONMENT.SALES_RECEIPT_BARCODE_START,
    });

    cartNo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      terminalId: ENVIRONMENT.TERMINAL_ID,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.dPointUsePointCancel(step.dPointUsePointCancel, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has dPoint payment",
        expected: {
          paidGroupCd: PAID_METHOD.COMMON_POINT.GROUP_CODE,
          paidCd: PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_CODE,
          paidName: PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_NAME,
        },
        actual: (res) => {
          const voidPayment = res.result?.cartinfo?.void_payments?.find(q => q.paid_cd === PAID_METHOD.COMMON_POINT.PAID_ITEMS.D_POINT.PAID_CODE);
          return {
            paidGroupCd: voidPayment?.paid_group_cd,
            paidCd: voidPayment?.paid_cd,
            paidName: voidPayment?.paid_name,
          };
        },
      }),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
 * @function レシート返品
（掛売）
 * @memberof 返品.返品中止
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.RETURN}
 * {@link TAGS.CANCELING_RETURNS}
 * {@link TAGS.RETURN_OF_ENTIRE_TRANSACTION_RETURN_OF_ENTIRE_RECEIPT}
 * {@link TAGS.CREDIT_SALE}
 * ### テスト観点
 * * 前提：
 * * テスト観点：
 * * 掛売で売り上げた商品が、レシート返品の途中で中止できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 掛売客情報検索 | `/accounts-receivable/search` |
 * | 5 | 掛売支払登録 | `/sales/cart/accounts-receivable` |
 * | 6 | 取引完了 | `/sales/end` |
 * | 7 | 【返品】取引開始 | `/refund/begin` |
 * | 8 | 【返品】小計 | `/refund/subtotal` |
 * | 9 | 【返品】【掛売】掛売 | `/refund/cart/accounts-receivable` |
 * | 10 | 【返品】取引中断 | `/refund/abort` |
 * 
 * ---
 * ### 前提条件
 * * 販売取引はテストの観点に基づき、TC_107で検証済み。 
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品 : 4500000000121
 * * 2.顧客電話番号: 0252400711
 * 
 * ---
 * ### 期待結果
 * * #### 9.【返品】【掛売】掛売 `/refund/cart/accounts-receivable`
 * * \- カート情報に 掛売 支払いが含まれていることを確認
 * * * \+ void_payments に 掛売 支払いが含まれていること
 * * * * \. void_payments[].paid_group_cd = "0700"
 * * * * \. void_payments[].paid_cd = "0701"
 * * * * \. void_payments[].paid_name = "売掛金"
 * * #### 10.【返品】取引中断 `/refund/abort`
 * * \- 中断が正常に完了し、receipt_no が取得できていることを確認
 * * * \+ Status: 200
 * * * \+ Receipt_no > 0
 */
export function TC_021334006_RefundAbortDebtSales() {
  group("TC_021334006 レシート返品（掛売）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      searchAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.ACCOUNTS_RECEIVABLE_SEARCH),
      accountsReceivable: CommonFunction.getFullDesc(ENDPOINT.SALES_ACCOUNTS_RECEIVABLE),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      refundBegin: CommonFunction.getFullDesc(ENDPOINT.REFUND_BEGIN),
      refundSubtotal: CommonFunction.getFullDesc(ENDPOINT.REFUND_SUBTOTAL),
      refundAccountsReceivable: CommonFunction.getFullDesc(ENDPOINT.REFUND_ACCOUNTS_RECEIVABLE),
      refundAbort: CommonFunction.getFullDesc(ENDPOINT.REFUND_ABORT),
    };

    const paidGroupCd = PAID_METHOD.ACCOUNTS_RECEIVABLE.GROUP_CODE;
    const paidCd = PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_CODE;
    const paidName = PAID_METHOD.ACCOUNTS_RECEIVABLE.PAID_ITEMS.ACCOUNTS_RECEIVABLE.PAID_NAME;

    let cartNo = TestHelper.salesBegin(step.begin, {
      isSelf: false,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
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

    const salesCartInfo = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo;

    const clientInfos = TestHelper.searchAccountsReceivable(step.searchAccountsReceivable, {}, [
      CHECK.createStatusCodeCheck(),
    ]).result?.client_infos;

    const clientInfo = clientInfos?.find(c => c.client_tel_no === ENVIRONMENT.CLIENT_TEL_NO);
    const clientCd = clientInfo?.client_cd;

    TestHelper.salesAccountsReceivable(step.accountsReceivable, {
      cartNo,
      clientCd,
      paidAmount: salesCartInfo?.total_balance_amount,
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

    cartNo = TestHelper.refundBegin(step.refundBegin, {
      receiptBarcode,
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
    }, [
      CHECK.createStatusCodeCheck(),
    ]).result?.cartinfo?.cart_no;

    TestHelper.refundSubtotal(step.refundSubtotal, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.refundAccountsReceivable(step.refundAccountsReceivable, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart info has 掛売 payment",
        expected: {
          paidGroupCd,
          paidCd,
          paidName,
        },
        actual: (res) => {
          const accountsReceivableVoidPayment = res.result?.cartinfo?.void_payments?.find(p => p.paid_cd === paidCd);
          return {
            paidGroupCd: accountsReceivableVoidPayment?.paid_group_cd,
            paidCd: accountsReceivableVoidPayment?.paid_cd,
            paidName: accountsReceivableVoidPayment?.paid_name,
          };
        },
      }),
    ]);

    TestHelper.refundAbort(step.refundAbort, {
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
