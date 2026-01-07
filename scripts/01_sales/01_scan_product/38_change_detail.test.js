import { group, sleep } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { TestHelper } from "../../../common/test_helper.js";
import { Formular } from "../../../common/formular.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import * as TAGS from "../../../tags/tags_const.js";
/**
 * @function 一連の商品登録・商品明細取消・売価変更・数量変更
 * @memberof 売上.商品種類
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.NONPLU}
 * {@link TAGS.CHANGE_DETAILS}
 * {@link TAGS.SELLING_PRICE_CHANGE}
 * {@link TAGS.DELETE_DETAILS}
 * ### テスト観点
 * * 前提：
 * * * ・利用商品は何でもよい。
 * * * ・商品明細取消：通常医薬品
 * * * ・売価変更：通常商品
 * * * ・数量変更：NONPLU商品
 * * テスト観点：
 * * 商品登録時に明細の取消・変更の一連動作が出来ることを確認する。
 * * 一連操作：商品明細取消、売価変更、数量変更
 * * * ・小計では通常商品とNONPLU商品しかない。
 * * * ・通常商品は売価が変更された金額になっている。
 * * * ・NONPLU商品は数量が変更された数量になっている。
 * * * ・取引完了にはレシートnoが確認できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常医薬品スキャン | `/sales/cart/barcode` |
 * | 3 | 通常商品スキャン | `/sales/cart/barcode` |
 * | 4 | NONPLU商品スキャン | `/sales/cart/barcode` |
 * | 5 | 通常医薬品削除 | `/sales/cart/deleteitem` |
 * | 6 | 通常商品売価変更 | `/sales/cart/changeitemprice` |
 * | 7 | NONPLU商品数量変更 | `/sales/cart/changeitemquantity` |
 * | 8 | 小計 | `/sales/subtotal` |
 * | 9 | 支払登録 | `/sales/addpayment` |
 * | 10 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * \- 通常商品を新価格に設定（０ではない）
 * 
 * ---
 * ### テストデータ
 * * 1.通常医薬品: 4500000000025
 * * 2.通常商品 : 4500000000121
 * * 3.NONPLU商品 : 0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 2.通常医薬品スキャン `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認: 
 * * \- 通常医薬品
 * * * \+ barcode : 4500000000025
 * * #### 3.通常商品スキャン `/sales/cart/barcode` (item B)
 * * カート情報に以下の商品が含まれていることを確認: 
 * * \- 通常商品
 * * * \+ barcode : 4500000000121
 * * \- 通常商品の価格を確認
 * * * \+ unit_price = display_unit_price = 400 (マスタデータ)
 * * #### 4.NONPLU商品スキャン `/sales/cart/barcode` (item C)
 * * カート情報に以下の商品が含まれていることを確認: 
 * * \- NONPLU商品
 * * * \+ barcode : 0445000700000
 * * * \+ quantity : 1
 * * #### 5.通常医薬品削除 `/sales/cart/deleteitem`
 * * カート情報に以下の商品が含まれていないことを確認: 
 * * \- 通常医薬品 (4500000000025)
 * * カート情報に以下の商品が含まれていることを確認: 
 * * \- 通常商品
 * * * \+ barcode : 4500000000121
 * * \- NONPLU商品
 * * * \+ barcode : 0445000700000
 * * #### 6.通常商品売価変更 `/sales/cart/changeitemprice`
 * * 「通常商品」の売価変更が変更されたことを確認
 * * * \+ display_unit_price !== unit_price (Step 3の価格)
 * * #### 7.NONPLU商品数量変更 `/sales/cart/changeitemquantity`
 * * 「NONPLU商品」の商品数量が変更されたことを確認
 * * * \+ quantity: 3（リクエストデータ）
 * * #### 8.小計 `/sales/subtotal`
 * * Cart Info に ４つのアイテムがあるか確認
 * * Cart Info に 通常商品 : 4500000000121があるか確認
 * * Cart Info に ３つのアイテム NONPLU商品 : 0445000700000があるか確認
 * * 通常商品の価格が変更されたか 確認
 * * * \+ display_unit_price: 812
 * * NONPLU商品の数量が変更されたか確認
 * * * \+ quantity: 3
 * * 合計額を確認
 * * * \+ 通常商品 の価格は 812, 税率: 8%
 * * * * \. tax = display_unit_price x  tax_rate / 100 = 812x8`/100` = 64 (to round down)
 * * * * \. totalAmountWithTax = display_unit_price + tax = 812 + 64 = 876
 * * * \+ item NONPLU商品の価格は 812, 税率: 8%, 数量 3
 * * * * \. tax = display_unit_price x quantity x tax_rate / 100 = 100x3x8`/100` = 24
 * * * * \. totalAmountWithTax = display_unit_price x quantity + tax = 100 x 3 + 24= 324
 * * * \+ total_balance_amount = 通常商品のtotalAmountWithTax + NONPLU商品のtotalAmountWithTax = 876 + 324 =1200
 * * #### 10.取引完了 `/sales/end`
 * * \- レシートが正しく印刷され、以下の商品が含まれていること。
 * * * \+ 通常商品 (4500000000121)
 * * * \+ NONPLU商品 (0445000700000)あい
 */
export function TC_010138001_RegisterCancelProductAndChangePriceQuantity() {
  group("TC_010138001 一連の商品登録・商品明細取消・売価変更・数量変更", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeDrugRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常医薬品スキャン"),
      barcodeRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcodeNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      deleteItemDrugRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_DELETE_ITEM, "通常医薬品削除"),
      changePriceRegular: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_PRICE, "通常商品売価変更"),
      changeQuantityNonPlu: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_CHANGE_ITEM_QUANTITY, "NONPLU商品数量変更"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const prodRegularPrice = 400; // Specified in master
    const updatedQuantity = 3; // Test data

    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.通常医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcodeDrugRegular, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_REGULAR,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 通常医薬品: barcode",
        expected: PROD.DRUG_REGULAR,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
    ]);

    // 3.通常商品スキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify 通常商品: barcode",
        expected: PROD.REGULAR,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify original price",
        expected: prodRegularPrice,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.unit_price,
      }),
    ]);

    // 4.NONPLU商品スキャン /sales/cart/barcode
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
      CHECK.createEqualsCheck({
        name: "Verify NONPLU商品: barcode",
        expected: PROD.NONPLU_MATCHED,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify original quantity",
        expected: 1,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.quantity,
      }),
    ]);

    // 5.通常医薬品削除 /sales/cart/deleteitem
    TestHelper.salesCartDeleteItem(step.deleteItemDrugRegular, {
      cartNo,
      statementNo: 0,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the cart info does not contains item 通常医薬品",
        expected: false,
        actual: (res) => CommonFunction.hasItems([
          PROD.DRUG_REGULAR,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains item 通常商品 and NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
    ]);

    // Generate price to a new price (non-zero)
    const updatedPrice = Math.floor(Math.random() * (prodRegularPrice - 1)) + 1;

    //6.通常商品売価変更 /sales/cart/changeitemprice
    TestHelper.salesCartChangeItemPrice(step.changePriceRegular, {
      cartNo,
      statementNo: 0,
      updatedPrice,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the price of item 通常商品 has been changed",
        expected: updatedPrice,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.display_unit_price,
      }),
    ]);

    //7.NONPLU商品数量変更 /sales/cart/changeitemquantity
    TestHelper.salesCartChangeItemQuantity(step.changeQuantityNonPlu, {
      cartNo,
      statementNo: 1,
      updatedQuantity,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify the quantity of item NONPLU商品 has been changed",
        expected: updatedQuantity,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.quantity,
      }),
    ]);

    //8.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "The cart info has 4 products",
        expected: 4,
        actual: (res) => res.result?.cartinfo?.total_quantity,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the cart info contains item 通常商品 and NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.hasItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.cartinfo?.items),
      }),
      CHECK.createEqualsCheck({
        name: "Verify the price of item 通常商品 has been changed",
        expected: updatedPrice,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.display_unit_price,
      }),
      CHECK.createEqualsCheck({
        name: "Verify the quantity of item NONPLU商品 has been changed",
        expected: updatedQuantity,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.quantity,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalSalesAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 9.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.AUTOMATIC_CHANGE_MACHINE.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.KOUTSU_DETAIL,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 10.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Receipt data must contain 2 scanned items: 通常商品 and NONPLU商品",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.REGULAR,
          PROD.NONPLU_MATCHED,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function 商品売価変更（０円に変更）
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.SELLING_PRICE_CHANGE}
 * {@link TAGS.TAG_0_YEN}
 * ### テスト観点
 * * * ・売価を0円に変更することにより支払登録をせず取引完了できる
 * * * ・レシートnoが確認できる
 * * * ・t_payment テーブルに0円商品の取引が確認できる
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 0円商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 取引完了 | `/sales/end` |
 * | 5 | 売上ジャーナルトラン | `/salesdata/tran/getdata` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.0円商品: 1050000012001
 * 
 * ---
 * ### 期待結果
 * * #### 3.小計 `/sales/subtotal`
 * * \- 小計が0円であるか確認する
 * * * \+ total_balance_amount: 0
 * * #### 4.取引完了 `/sales/end`
 * * \- レシートが正しく印刷されるか確認する
 * * * \+ レシートに 0円商品の情報があること確認
 * * #### 5.売上ジャーナルトラン `SalesData/tran/getdata`
 * * \- レスポンスに以下のテーブルに0円取引データの有無を確認する
 * * * \+ 支払トラン
 */
export function TC_010138004_ChangeProductSellingPriceToZero() {
  group("TC_010138004 商品売価変更（０円に変更）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeZeroYen: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "0円商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
      getSalesData: CommonFunction.getFullDesc(ENDPOINT.SALES_DATA_TRAN_GET_DATA, "売上ジャーナルトラン"),
    };

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_BARCODE,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeZeroYen, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.ZERO_YEN,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify cart price is 0円",
        expected: 0,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]);

    const salesEndRes = TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt is printed correctly",
        expected: true,
        actual: (res) => CommonFunction.checkReceiptData([
          PROD.ZERO_YEN,
        ], res.result?.receipts),
      }),
    ]);

    sleep(3);

    const receiptNo = salesEndRes.result?.receipt_no;
    const businessDay = salesEndRes.result?.business_day;

    TestHelper.getSalesData(step.getSalesData, {
      storeCd: ENVIRONMENT.STORE_CD,
      posCd: ENVIRONMENT.POS_CD,
      businessDay,
      receiptNo,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify response has data of 支払トラン",
        expected: true,
        actual: (res) => res.result?.payments?.length > 0,
      }),
    ]);
  });
}
