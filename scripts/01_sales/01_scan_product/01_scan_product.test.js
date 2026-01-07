import { group } from "k6";
import * as CHECK from "../../../common/common_check.js";
import * as ENDPOINT from "../../../common/endpoint_const.js";
import * as ENVIRONMENT from "../../../common/environment_const.js";
import * as PROD from "../../../common/constant/product.js";
import { TestHelper } from "../../../common/test_helper.js";
import { PAID_METHOD } from "../../../common/constant/paid_methods.js";
import { CommonFunction } from "../../../common/common_function.js";
import { RECEIPT_TYPE } from "../../../common/constant/receipt_type.js";
import { Formular } from "../../../common/formular.js";
import * as TAGS from "../../../tags/tags_const.js";

/**
 * @function 通常商品複数登録（正常系）
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.CODE_INPUT}
 * {@link TAGS.NONPLU}
 * {@link TAGS.BARCODE_SCAN}
 * ### テスト観点
 * * * ・適正な商品価格を参照している
 * * * * →　通常商品
 * * * * NONPLU商品
 * * * ・小計には２個の商品と販売価格が確認できる。
 * * * ・取引完了にはレシートNOが確認できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 商品Aスキャン | `/sales/cart/barcode` |
 * | 3 | 商品Bスキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常商品：4500000000121
 * * 2.NONPLU商品：0445000701007
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * カート情報に以下2つの商品が含まれていることを確認する:  
 * * \- 通常商品：
 * * * \+ barcode:  4500000000121
 * * * \+ quantity: 1
 * * * \+ unit_price:  400
 * * * \+ display_unit_price: 400
 * * * \+ rax_rate: 8
 * * \- NONPLU商品：
 * * * \+ barcode: 0445000700000
 * * * \+ quantity: 1
 * * * \+ unit_price: 0
 * * * \+ display_unit_price: 100
 * * * \+ nonplu_price: 100
 * * * \+ rax_rate: 8
 * * \- total_balance_amountを確認: 540 = 400+400*8% +100+100*8%
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷され、2つの商品情報（通常商品とNONPLU商品）が含まれていること。
 */
export function TC_010101001_RegularProductMultipleRegistrationsNormal() {
  group("TC_010101001 通常商品複数登録（正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常商品スキャン"),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "NONPLU商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };
    // 1.取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.通常商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
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

    // 3.NONPLU商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
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

    // 4.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 通常商品: barcode",
        expected: PROD.REGULAR,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify NONPLU商品: barcode",
        expected: PROD.NONPLU_MATCHED,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: 540,
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    });

    // 6.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain 2 scanned items",
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
 * @function ドラッグ商品複数登録（濫用禁止チェック正常系）
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PRODUCT_CHECK}
 * {@link TAGS.PHARMACEUTICALS}
 * {@link TAGS.NO_ABUSE_ALLOWED}
 * ### テスト観点
 * * 濫用禁止チェックの確認
 * * 同一成分の商品が１取引で2個以上でない場合は販売できる。
 * * * → 成分要確認商品1
 * * * 成分確認不要商品
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 商品Aスキャン | `/sales/cart/barcode` |
 * | 3 | 商品Bスキャン | `/sales/cart/barcode` |
 * | 4 | 小計 | `/sales/subtotal` |
 * | 5 | 支払登録 | `/sales/addpayment` |
 * | 6 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.成分要確認商品1 :   4500000000117
 * * 2.成分確認不要商品 :   4500000000108
 * 
 * ---
 * ### 期待結果
 * * #### 4. 小計 `/sales/subtotal`
 * * カート情報に以下2つの商品が含まれていることを確認する:  
 * * \- 成分要確認商品1：
 * * * \+ barcode: 4500000000117
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * \- 成分確認不要商品：
 * * * \+ barcode: 4500000000108
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * #### 6. 取引完了 `/sales/end`
 * * \- レシートが正しく印刷され、2つの商品情報（成分要確認商品1 と 成分確認不要商品）が含まれていること。
 */
export function TC_010101002_MultipleDrugProductsRegisteredNormalChecksForAbuse() {
  group("TC_010101002 ドラッグ商品複数登録（濫用禁止チェック正常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "成分要確認商品1スキャン "),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "成分確認不要商品スキャン "),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };
    // 1. 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      signnedEmployeeCd: "",
      operateEmployeeCd: "00001",
      isSelf: false,
      terminalId: "6408903999802",
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.成分要確認商品1スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.CHECK_INGRE_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 3.成分確認不要商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NOCHECK_INGRE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 4.小計 /sales/subtotal
    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify items length equals 2",
        expected: 2,
        actual: (res) => res.result?.cartinfo?.items?.length,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 成分要確認商品1: barcode",
        expected: PROD.CHECK_INGRE_1,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
      CHECK.createEqualsCheck({
        name: "Verify 成分確認不要商品: barcode",
        expected: PROD.NOCHECK_INGRE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    // 5.支払登録 /sales/addpayment
    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.QRCODE.GROUP_CODE,
      paidCode: PAID_METHOD.QRCODE.PAID_ITEMS.LINE_PAY.PAID_CODE,
      totalBalanceAmount,
      details: ENVIRONMENT.LINEPAY_DETAIL,
    });

    // 6.取引完了 /sales/end
    TestHelper.salesEnd(step.end, {
      cartNo,
      endDatetime: CommonFunction.getTimeNow(),
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify receipt data must contain 2 scanned items",
        expected: true,
        actual: (res) => CommonFunction.includesItems([
          PROD.CHECK_INGRE_1,
          PROD.NOCHECK_INGRE,
        ], res.result?.receipts?.[0]?.receipt_data),
      }),
    ]);
  });
}

/**
 * @function ドラッグ商品複数登録（濫用禁止チェック異常系）
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PRODUCT_CHECK}
 * {@link TAGS.PHARMACEUTICALS}
 * {@link TAGS.NO_ABUSE_ALLOWED}
 * ### テスト観点
 * * 濫用禁止チェックの確認
 * * 同一成分の商品が１取引で2個以上販売できない。下記商品Cスキャン時エラー
 * * * → 成分要確認商品1
 * * * 成分確認不要商品
 * * * 第3類・成分要確認医薬品
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 商品Aスキャン | `/sales/cart/barcode` |
 * | 3 | 商品Bスキャン | `/sales/cart/barcode` |
 * | 4 | 商品Cスキャン | `/sales/cart/barcode` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.成分要確認商品1： 4500000000117
 * * 2.成分確認不要商品： 4500000000108
 * * 3.第3類・成分要確認医薬品： 4500000000125
 * 
 * ---
 * ### 期待結果
 * * #### 2. 成分要確認商品1 `/sales/cart/barcode`
 * * カート情報に成分要確認商品1が含まれていることを確認:  
 * * * \+ barcode: 4500000000117
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * #### 3. 成分確認不要商品 `/sales/cart/barcode`
 * * カート情報に成分確認不要商品が含まれていることを確認:  
 * * * \+ barcode: 4500000000108
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * #### 4. 第3類・成分要確認医薬品 `/sales/cart/barcode`
 * * レスポンスを確認:  
 * * * \+ Status: 220
 * * * \+ Error message: "同一の成分チェックグループに属する医薬品が登録済みです"
 * * * \+ Error code: "CAT0018"
 */
export function TC_010101003_MultipleDrugProductsRegisteredAbuseProhibitedCheckAbnormality() {
  group("TC_010101003 ドラッグ商品複数登録（濫用禁止チェック異常系）", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "成分要確認商品1スキャン"),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "成分確認不要商品スキャン"),
      barcode3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "成分要確認商品2スキャン"),
    };
    // 1. 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.成分要確認商品1スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.CHECK_INGRE_1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 成分要確認商品1: barcode",
        expected: PROD.CHECK_INGRE_1,
        actual: (res) => res.result?.cartinfo?.items?.[0]?.barcode,
      }),
    ]);

    // 3.成分確認不要商品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.NOCHECK_INGRE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 成分確認不要商品: barcode",
        expected: PROD.NOCHECK_INGRE,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);

    // 4.成分要確認商品2スキャン /sales/cart/barcode　→　エラー終了
    TestHelper.salesCartBarcode(step.barcode3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.CHECK_INGRE_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CAT0018", "同一の成分チェックグループに属する医薬品が登録済みです"),
    ]);
  });
}

/**
 * @function 有人POSの医薬品複数登録
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PRODUCT_CHECK}
 * {@link TAGS.PHARMACEUTICALS}
 * {@link TAGS.CATEGORY_1}
 * ### テスト観点
 * * 有人POSでの医薬品販売チェックの確認
 * * 指定2類医薬品、第2類医薬品、第3類医薬品は販売できる。
 * * 第1類医薬品、要指導医薬品は販売できない。
 * * * → 通常医薬品
 * * * 指定2類医薬品
 * * * 第2類医薬品
 * * * 第3類医薬品
 * * * 要指導医薬品
 * * * 第1類医薬品
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常医薬品スキャン | `/sales/cart/barcode` |
 * | 3 | 指定2類医薬品スキャン | `/sales/cart/barcode` |
 * | 4 | 第2類医薬品スキャン | `/sales/cart/barcode` |
 * | 5 | 第3類医薬品スキャン | `/sales/cart/barcode` |
 * | 6 | 要指導医薬品スキャン | `/sales/cart/barcode` |
 * | 7 | 第1類医薬品スキャン | `/sales/cart/barcode` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常医薬品: 4500000000025
 * * 2.指定2類医薬品: 4500000000156
 * * 3.第2類医薬品: 4500000000118
 * * 4.第3類医薬品: 4500000000125
 * * 5.要指導医薬品: 4500000000162
 * * 6.第1類医薬品：4500000000131
 * 
 * ---
 * ### 期待結果
 * * 2 通常医薬品 `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 通常医薬品 :
 * * * \+ barcode: 4500000000025
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * #### 3. 指定2類医薬品 `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 指定2類医薬品
 * * * \+ barcode: 4500000000156
 * * * \+ unit_price: 3000
 * * * \+ display_unit_price: 3000
 * * #### 4. 第2類医薬品 `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 第2類医薬品
 * * * \+ barcode: 4500000000118
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * #### 5. 第3類医薬品 `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 第3類医薬品
 * * * \+ barcode: 4500000000125
 * * * \+ unit_price: 2000
 * * * \+ display_unit_price: 2000
 * * #### 6. 要指導医薬品スキャン `/sales/cart/barcode`
 * * 以下のようなレスポンスが返却されること
 * * * \+ Status: 220
 * * * \+ Error message: "お使いのPOSで販売禁止に指定されている商品です".
 * * * \+ Error code: "CAT0017"
 * * #### 7. 第1類医薬品 `/sales/cart/barcode`
 * * 以下のようなレスポンスが返却されること
 * * * \+ Status: 220
 * * * \+ Error message: "お使いのPOSで販売禁止に指定されている商品です".
 * * * \+ Error code: "CAT0017"
 */
export function TC_010101005_MultipleRegistrationsForMannedPOSDrugs() {
  group("TC_010101005 有人POSの医薬品複数登録", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常医薬品スキャン"),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "指定2類医薬品スキャン"),
      barcode3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "第2類医薬品スキャン"),
      barcode4: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "第3類医薬品スキャン"),
      barcode5: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "要指導医薬品スキャン"),
      barcode6: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "第1類医薬品スキャン"),
    };
    // 1. 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: "10000010",
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2. 通常医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
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

    // 3.指定2類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_DESIGNATED_CAT2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 指定2類医薬品: barcode",
        expected: PROD.DRUG_DESIGNATED_CAT2,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);

    // 4.第2類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_CAT2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 第2類医薬品: barcode",
        expected: PROD.DRUG_CAT2,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.barcode,
      }),
    ]);

    // 5.第3類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode4, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_CAT3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 第3類医薬品: barcode",
        expected: PROD.DRUG_CAT3,
        actual: (res) => res.result?.cartinfo?.items?.[3]?.barcode,
      }),
    ]);

    // 6.要指導医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode5, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_PHARMA_GUIDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CAT0017", "お使いのPOSで販売禁止に指定されている商品です"),
    ]);

    // 7.第1類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode6, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_CAT1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CAT0017", "お使いのPOSで販売禁止に指定されている商品です"),
    ]);
  });
}

/**
 * @function セルフPOSの医薬品複数登録
 * @memberof 売上.商品明細登録
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_DETAILS_REGISTRATION}
 * {@link TAGS.PRODUCT_CHECK}
 * {@link TAGS.PHARMACEUTICALS}
 * {@link TAGS.DESIGNATED_SECOND_CLASS}
 * ### テスト観点
 * * セルフPOSでの医薬品販売チェックの確認
 * * 指定2類医薬品、第2類医薬品、第3類医薬品は販売できる。
 * * 第1類医薬品、要指導医薬品は販売できない。
 * * * → 通常医薬品
 * * * 第2類医薬品
 * * * 第3類医薬品
 * * * 要指導医薬品
 * * * 第1類医薬品
 * * * 指定2類医薬品
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 通常医薬品スキャン | `/sales/cart/barcode` |
 * | 3 | 第2類医薬品スキャン | `/sales/cart/barcode` |
 * | 4 | 第3類医薬品スキャン | `/sales/cart/barcode` |
 * | 5 | 要指導医薬品スキャン | `/sales/cart/barcode` |
 * | 6 | 第1類医薬品スキャン | `/sales/cart/barcode` |
 * | 7 | 指定2類医薬品スキャン | `/sales/cart/barcode` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.通常医薬品：4500000000025
 * * 2.第2類医薬品: 4500000000118
 * * 3.第3類医薬品：4500000000125
 * * 4.要指導医薬品: 4500000000162
 * * 5.第1類医薬品: 4500000000131
 * * 6.指定2類医薬品: 4500000000156
 * 
 * ---
 * ### 期待結果
 * * #### 2. 通常医薬品  `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 通常医薬品   :
 * * * \+ barcode: 4500000000025
 * * * \+ unit_price: 200
 * * * \+ display_unit_price: 200
 * * #### 3. 第2類医薬品 `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 第2類医薬品 :
 * * * \+ barcode: 4500000000118
 * * * \+ unit_price: 1000
 * * * \+ display_unit_price: 1000
 * * #### 4. 第3類医薬品 `/sales/cart/barcode`
 * * カート情報に以下の商品が含まれていることを確認:  
 * * \- 第3類医薬品:
 * * * \+ barcode: 4500000000125
 * * * \+ unit_price: 2000
 * * * \+ display_unit_price: 2000
 * * #### 5. 要指導医薬品スキャン `/sales/cart/barcode`
 * * 以下のようなレスポンスが返却されること
 * * * \+ Status: 220
 * * * \+ Error message: "お使いのPOSで販売禁止に指定されている商品です".
 * * * \+ Error code: "CAT0017"
 * * #### 6. 第1類医薬品 `/sales/cart/barcode`
 * * 以下のようなレスポンスが返却されること
 * * * \+ Status: 220
 * * * \+ Error message: "お使いのPOSで販売禁止に指定されている商品です".
 * * * \+ Error code: "CAT0017"
 * * #### 7. 指定2類医薬品スキャン `/sales/cart/barcode`
 * * 以下のようなレスポンスが返却されること
 * * * \+ Status: 220
 * * * \+ Error message: "お使いのPOSでは指定二類医薬品は扱えません".
 * * * \+ Error code: "CAT0020"
 */
export function TC_010101009_RegisterMultipleDrugsForSelfPOS() {
  group("TC_010101009 セルフPOSの医薬品複数登録", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcode1: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "通常医薬品スキャン"),
      barcode2: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "第2類医薬品スキャン"),
      barcode3: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "第3類医薬品スキャン"),
      barcode4: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "要指導医薬品スキャン"),
      barcode5: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "第1類医薬品スキャン"),
      barcode6: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "指定2類医薬品スキャン"),
    };
    // 1. 取引開始 /sales/begin
    const cartNo = TestHelper.salesBegin(step.begin, {}, [
      CHECK.createStatusCodeCheck(),
    ]);

    // 2.通常医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode1, {
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

    // 3.第2類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode2, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_CAT2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 第2類医薬品: barcode",
        expected: PROD.DRUG_CAT2,
        actual: (res) => res.result?.cartinfo?.items?.[1]?.barcode,
      }),
    ]);

    // 4.第3類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode3, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_CAT3,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify 第3類医薬品: barcode",
        expected: PROD.DRUG_CAT3,
        actual: (res) => res.result?.cartinfo?.items?.[2]?.barcode,
      }),
    ]);

    // 5.要指導医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode4, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_PHARMA_GUIDE,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CAT0017", "お使いのPOSで販売禁止に指定されている商品です"),
    ]);

    // 6.第1類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode5, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_CAT1,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CAT0017", "お使いのPOSで販売禁止に指定されている商品です"),
    ]);

    // 7.指定2類医薬品スキャン /sales/cart/barcode
    TestHelper.salesCartBarcode(step.barcode6, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.DRUG_DESIGNATED_CAT2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(220),
      CHECK.createErrorCheck("CAT0020", "お使いのPOSでは指定二類医薬品は扱えません"),
    ]);
  });
}

/**
 * @function 書籍販売
 * @memberof 返品.商品種類
 * @description
 * {@link TAGS.POS}
 * {@link TAGS.SALES}
 * {@link TAGS.PRODUCT_TYPE}
 * {@link TAGS.TAG_2_TIERS_OF_BOOKS}
 * ### テスト観点
 * * テスト観点：
 * * * ・適正な商品価格を参照している
 * * * * →　書籍商品：書籍（バーコードの価格）
 * * * *    2段式バーコード or 書籍(JAN13-アドオン5)
 * * * ・小計には1個の商品と販売価格が確認できる。
 * * * ・取引完了にはレシートNOが確認できる。
 * 
 * ---
 * ### テスト方法/シナリオ
 * | Step | 手順 | エンドポイント |
 * | :-: | :--- | :--- |
 * | 1 | 取引開始 | `/sales/begin` |
 * | 2 | 書籍商品スキャン | `/sales/cart/barcode` |
 * | 3 | 小計 | `/sales/subtotal` |
 * | 4 | 支払登録 | `/sales/addpayment` |
 * | 5 | 取引完了 | `/sales/end` |
 * 
 * ---
 * ### 前提条件
 * * 特になし
 * 
 * ---
 * ### テストデータ
 * * 1.書籍商品
 * * \- barcode_1: 9784799313282
 * * \- barcode_2: 1921234010008
 * 
 * ---
 * ### 期待結果
 * * #### 2.書籍商品スキャン `/sales/cart/barcode`
 * * \- カート情報に書籍商品が含まれていることを確認:
 * * * \+item_cd = 479931328 (バーコード1の 4〜12 桁)
 * * #### 3. 小計 `/sales/subtotal`
 * * \- カートに商品が1件のみであることを確認:
 * * * \+ items.length = 1
 * * * \+ unit_price = 1000 (バーコード2の 9〜12 桁)
 * * \- 合計金額を確認
 * * *  = unit_price + unit_price * (tax_rate / 100)
 * * * \= 1000 + 1000 * 10% = 1100
 * * #### 4. 支払登録 `/sales/addpayment`
 * * \- 取消支払（void payment）が現金であることを確認:
 * * * \+ total_balance_amount = 0
 * * * \+ void_payment に以下が含まれる:
 * * * * \.paid_cd = "0101"
 * * * * \.paid_name = "現金"
 * * * * \.paid_amount = total_balance_amount (手順3の値)
 * * #### 6. 取引完了 `/sales/end`
 * * \- 取得したレシート番号が有効であることを確認 (receipt_no > 0)
 */
export function TC_010101013_BookSales() {
  group("TC_010101013 書籍販売", () => {
    const step = {
      begin: CommonFunction.getFullDesc(ENDPOINT.SALES_BEGIN),
      barcodeBookTwoTier: CommonFunction.getFullDesc(ENDPOINT.SALES_CART_BARCODE, "書籍商品スキャン"),
      subtotal: CommonFunction.getFullDesc(ENDPOINT.SALES_SUBTOTAL),
      payment: CommonFunction.getFullDesc(ENDPOINT.SALES_ADDPAYMENT, "支払登録 (現金払い)"),
      end: CommonFunction.getFullDesc(ENDPOINT.SALES_END),
    };

    const bookProdInfo = CommonFunction.createObjectFromBookJanProd(PROD.BOOK_TWO_TIER_1, PROD.BOOK_TWO_TIER_2);

    const cartNo = TestHelper.salesBegin(step.begin, {
      operateEmployeeCd: ENVIRONMENT.EMPLOYEE_CD,
      isSelf: false,
    }, [
      CHECK.createStatusCodeCheck(),
    ]);

    TestHelper.salesCartBarcode(step.barcodeBookTwoTier, {
      cartNo,
      barcodes: [
        {
          barcode: PROD.BOOK_TWO_TIER_1,
          scan_data_type: "JAN13",
        },
        {
          barcode: PROD.BOOK_TWO_TIER_2,
          scan_data_type: "JAN13",
        },
      ],
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that cart info has 書籍商品",
        expected: true,
        actual: (res) => res.result?.cartinfo?.items?.some(item => item.item_cd === bookProdInfo?.itemCd),
      }),
    ]);

    const totalBalanceAmount = TestHelper.salesSubtotal(step.subtotal, cartNo, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that cart info contains 1 product",
        expected: {
          itemsLength: 1,
          unitPrice: bookProdInfo?.displayUnitPrice,
        },
        actual: (res) => {
          const itemInfo = res.result?.cartinfo?.items?.find(item => item.item_cd === bookProdInfo?.itemCd);
          return {
            itemsLength: res.result?.cartinfo?.items?.length,
            unitPrice: itemInfo?.unit_price,
          };
        },
      }),
      CHECK.createEqualsCheck({
        name: "Verify total balance amount",
        expected: (res) => Formular.calcTotalBalanceAmount(res.result?.cartinfo?.items),
        actual: (res) => res.result?.cartinfo?.total_balance_amount,
      }),
    ]).result?.cartinfo?.total_balance_amount;

    TestHelper.salesAddPayment(step.payment, {
      cartNo,
      paidGroupCode: PAID_METHOD.CASH.GROUP_CODE,
      paidCode: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
      totalBalanceAmount,
      details: "",
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that the void payment method is 現金",
        expected: {
          totalBalanceAmount: 0,
          paidCd: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE,
          paidName: PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_NAME,
          paidAmount: totalBalanceAmount,
        },
        actual: (res) => {
          const cashPayment = res.result?.cartinfo?.payments?.find(p => p.paid_cd === PAID_METHOD.CASH.PAID_ITEMS.DRAWER.PAID_CODE);
          return {
            totalBalanceAmount: res.result?.cartinfo?.total_balance_amount,
            paidCd: cashPayment?.paid_cd,
            paidName: cashPayment?.paid_name,
            paidAmount: cashPayment?.paid_amount,
          };
        },
      }),
    ]);

    TestHelper.salesEnd(step.end, {
      cartNo,
      receiptType: RECEIPT_TYPE.NORMAL.VALUE,
    }, [
      CHECK.createStatusCodeCheck(),
      CHECK.createEqualsCheck({
        name: "Verify that data contains an existing receipt number",
        expected: true,
        actual: (res) => res.result?.receipt_no > 0,
      }),
    ]);
  });
}
